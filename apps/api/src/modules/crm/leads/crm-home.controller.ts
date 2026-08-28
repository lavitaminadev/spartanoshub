import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import type { AuthenticatedRequest } from '@shared/types/request';
import { CrmHomeService } from './crm-home.service';
import { veSoloLoSuyo } from './lead-visibility';
import { ClientCapabilityService } from '../../../core/client-scope/client-capability.service';
import { CrmDashboardService } from './crm-dashboard.service';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import { UserRole } from '../../organizations/user-role.enum';

/**
 * Lo que se ve al entrar al CRM.
 *
 * Existe aparte de `LeadController` porque no devuelve leads sino una lectura del estado del
 * trabajo: avisos y carga del equipo. Mezclarlo obligaría a que la pantalla de inicio dependiera
 * del alcance por cuenta de la lista de leads, que es otra pregunta.
 */
@Controller('crm/home')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
// `DEV` incluido: es quien levanta y comprueba los módulos antes de encenderlos, así que tiene
// que poder abrir la pantalla que va a habilitar. Faltaba, y el inicio del CRM le respondía 403.
// Sin `@Roles`: la matriz de permisos decide quién entra. Ver `lead.controller.ts` para el
// razonamiento completo. Acá el efecto era el más visible: el inicio del CRM respondía 403 a
// cargos que sí tenían el módulo, así que la sección existía en el menú y no se podía abrir.
@ModuleScope('crm')
export class CrmHomeController {
  constructor(
    private readonly home: CrmHomeService,
    private readonly dashboard: CrmDashboardService,
    private readonly accountAccess: AccountAccessService,
    private readonly capacidades: ClientCapabilityService,
  ) {}

  private async assertPortalCrm(req: AuthenticatedRequest): Promise<void> {
    if (req.user.role !== UserRole.CLIENT) return;
    if (!req.user.clientId) throw new ForbiddenException('La cuenta cliente no está asociada a una empresa');
    await this.capacidades.assert(req.organizationId!, req.user.clientId, 'crm');
  }

  @Get()
  @ApiOperation({ summary: 'Avisos y carga del equipo al entrar al CRM' })
  async get(
    @Req() req: AuthenticatedRequest,
    @Query('coolingDays') coolingDays?: string,
    @Query('domain') domain?: string,
    @Query('clientId') clientId?: string,
  ) {
    await this.assertPortalCrm(req);
    const effectiveClientId = req.user.role === UserRole.CLIENT ? req.user.clientId : clientId;
    const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId!, req.user);
    const agencyOnly = (domain === undefined || domain === 'commercial')
      && !effectiveClientId
      && allowedClientIds === undefined;
    // El plazo se acota acá y no solo en la pantalla: un valor absurdo llegado por la dirección
    // no debe poder pedir un rango que recorra toda la tabla.
    const dias = Math.min(Math.max(Number(coolingDays) || 7, 1), 90);
    // La empresa se comprueba como en el resto del CRM: llega del navegador y decide de quién
    // son los avisos, así que pedir una ajena no puede devolver los suyos.
    await this.accountAccess.assertClient(req.organizationId!, req.user, effectiveClientId);
    // El inicio del CRM de una empresa que no lo contrató no existe: se dice, no se dibuja vacío.
    await this.capacidades.assert(req.organizationId!, effectiveClientId, 'crm');
    const conCrm = !effectiveClientId && !agencyOnly
      ? await this.capacidades.filtrar(req.organizationId!, allowedClientIds, 'crm')
      : allowedClientIds;
    return this.home.home(req.organizationId!, dias, {
      domain: domain === 'audience' ? 'audience' : 'commercial',
      clientId: effectiveClientId || undefined,
      agencyOnly,
      // La empresa no ve cómo se reparte el trabajo dentro de la agencia.
      ocultarEquipo: req.user.role === UserRole.CLIENT,
      /*
       * Sin empresa elegida, la respuesta se acota a las que esta persona alcanza.
       *
       * Faltaba, y era la fuga más seria del módulo: el control comprobaba la empresa pedida, así
       * que **no pedir ninguna** lo saltaba entero y la respuesta cubría toda la organización.
       * Desde que el portal del cliente entra al CRM, eso significaba que una empresa veía las
       * cifras y los nombres de las demás sin adivinar nada.
       */
      allowedClientIds: conCrm,
      // Quien no dirige ve su propio trabajo y lo que está libre, no el embudo del equipo.
      onlyAssignedTo: veSoloLoSuyo(req.user.role, req.user.crmProfile) ? req.user.id : undefined,
    });
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Cifras del embudo comercial' })
  async panel(
    @Req() req: AuthenticatedRequest,
    @Query('days') days?: string,
    @Query('domain') domain?: string,
    @Query('clientId') clientId?: string,
  ) {
    await this.assertPortalCrm(req);
    const effectiveClientId = req.user.role === UserRole.CLIENT ? req.user.clientId : clientId;
    const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId!, req.user);
    const agencyOnly = (domain === undefined || domain === 'commercial')
      && !effectiveClientId
      && allowedClientIds === undefined;
    // Entre un día y un año: una ventana mayor recorre toda la tabla para responder algo que
    // nadie compara, y una menor a un día no distingue nada.
    const ventana = Math.min(Math.max(Number(days) || 30, 1), 365);
    // La cuenta se comprueba como en el resto del CRM: llega del navegador y decide de qué
    // empresa son las cifras, así que pedir una ajena no puede devolver sus números.
    await this.accountAccess.assertClient(req.organizationId!, req.user, effectiveClientId);
    await this.capacidades.assert(req.organizationId!, effectiveClientId, 'crm');
    const conCrm = !effectiveClientId && !agencyOnly
      ? await this.capacidades.filtrar(req.organizationId!, allowedClientIds, 'crm')
      : allowedClientIds;
    return this.dashboard.dashboard(req.organizationId!, ventana, {
      domain: domain === 'audience' ? 'audience' : 'commercial',
      clientId: effectiveClientId || undefined,
      agencyOnly,
      // El mismo alcance que el inicio: las dos pantallas responden por lo mismo.
      allowedClientIds: conCrm,
      // La misma regla del inicio y del listado: las tres pantallas deben contar lo mismo.
      onlyAssignedTo: veSoloLoSuyo(req.user.role, req.user.crmProfile) ? req.user.id : undefined,
    });
  }
}
