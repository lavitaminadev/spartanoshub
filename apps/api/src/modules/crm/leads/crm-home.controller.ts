import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../../core/authorization/roles.decorator';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { CrmHomeService } from './crm-home.service';
import { veSoloLoSuyo } from './lead-visibility';
import { CrmDashboardService } from './crm-dashboard.service';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';

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
  ) {}

  @Get()
  @ApiOperation({ summary: 'Avisos y carga del equipo al entrar al CRM' })
  async get(
    @Req() req: AuthenticatedRequest,
    @Query('coolingDays') coolingDays?: string,
    @Query('domain') domain?: string,
    @Query('clientId') clientId?: string,
  ) {
    // El plazo se acota acá y no solo en la pantalla: un valor absurdo llegado por la dirección
    // no debe poder pedir un rango que recorra toda la tabla.
    const dias = Math.min(Math.max(Number(coolingDays) || 7, 1), 90);
    // La empresa se comprueba como en el resto del CRM: llega del navegador y decide de quién
    // son los avisos, así que pedir una ajena no puede devolver los suyos.
    await this.accountAccess.assertClient(req.organizationId!, req.user, clientId);
    return this.home.home(req.organizationId!, dias, {
      domain: domain === 'audience' ? 'audience' : 'commercial',
      clientId: clientId || undefined,
      // Quien no dirige ve su propio trabajo y lo que está libre, no el embudo del equipo.
      onlyAssignedTo: veSoloLoSuyo(req.user.role) ? req.user.id : undefined,
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
    // Entre un día y un año: una ventana mayor recorre toda la tabla para responder algo que
    // nadie compara, y una menor a un día no distingue nada.
    const ventana = Math.min(Math.max(Number(days) || 30, 1), 365);
    // La cuenta se comprueba como en el resto del CRM: llega del navegador y decide de qué
    // empresa son las cifras, así que pedir una ajena no puede devolver sus números.
    await this.accountAccess.assertClient(req.organizationId!, req.user, clientId);
    return this.dashboard.dashboard(req.organizationId!, ventana, {
      domain: domain === 'audience' ? 'audience' : 'commercial',
      clientId: clientId || undefined,
      // La misma regla del inicio y del listado: las tres pantallas deben contar lo mismo.
      onlyAssignedTo: veSoloLoSuyo(req.user.role) ? req.user.id : undefined,
    });
  }
}
