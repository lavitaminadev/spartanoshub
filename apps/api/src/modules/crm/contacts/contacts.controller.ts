import { Controller, ForbiddenException, Get, Patch, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ContactsService } from './contacts.service';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import type { AuthenticatedRequest } from '@shared/types/request';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { ClientCapabilityService } from '../../../core/client-scope/client-capability.service';
import { UserRole } from '../../organizations/user-role.enum';
import { camposProtegidosDe } from '@espartanos/shared';
import { AuditService } from '../../../core/audit/audit.service';
import { NivelDeDatosService, recortarFilasPorEmpresa } from '../../../core/client-scope/nivel-de-datos.service';
import { exigirConstanciaDeRevelacion } from '../../../core/client-scope/revelar-protegidos';
import { RequiereArea } from '../../../core/authorization/requiere-area.decorator';

/**
 * Vínculos de personas con cuentas. **Solo lectura y anotación.**
 *
 * No hay alta ni baja: un contacto lo crea la automatización de captura a partir de un lead, y
 * dejar de tener relación con una cuenta no borra el histórico de reservas que cuelga de él.
 * Los endpoints de alta y baja que había estaban huérfanos —ninguna pantalla los usaba— y lo
 * único que ofrecían era crear contactos flotantes sin lead, invisibles para todo el sistema.
 *
 * Para crear o editar a la persona: `/crm/leads`. Acá solo vive su papel en la cuenta.
 */
@Controller('crm/contacts')
@UseGuards(AuthGuard('jwt'))
// Sin `@Roles`: la matriz de permisos decide quien entra. Ver `lead.controller.ts`.
@ModuleScope('crm')
export class ContactsController {
  constructor(
    private service: ContactsService,
    private readonly accountAccess: AccountAccessService,
    private readonly capabilities: ClientCapabilityService,
    private readonly niveles: NivelDeDatosService,
    private readonly audit: AuditService,
  ) {}

  /** El portal entra al CRM de la empresa que está mirando; ver el mismo método en `LeadController`. */
  private async assertPortalCrm(req: AuthenticatedRequest): Promise<void> {
    if (req.user.role !== UserRole.CLIENT) return;
    const pedida = (req.query as { clientId?: string } | undefined)?.clientId;
    if (typeof pedida !== 'string' || !pedida) {
      /*
       * Sin empresa pedida —la ficha de un lead, que va por su identificador— basta con que alguna
       * de las empresas que alcanza tenga CRM. Exigirlo en la de su cuenta dejaba sin fichas a quien
       * tiene CRM sólo en su segundo local. Qué lead puede abrir lo decide después su alcance.
       */
      const alcanzables = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
      const conCrm = await this.capabilities.filtrar(req.organizationId, alcanzables ?? [], 'crm');
      if (conCrm.length) return;
    }
    const empresa = await this.accountAccess.empresaDeTrabajo(req.organizationId, req.user, typeof pedida === 'string' ? pedida : undefined);
    if (!empresa) throw new ForbiddenException('La cuenta cliente no está asociada a una empresa');
    await this.capabilities.assert(req.organizationId, empresa, 'crm');
  }

  @Get()
  @RequiereArea('crm.contactos', 'ver')
  async findAll(@Query() query: ListContactsDto, @Req() req: AuthenticatedRequest) {
    await this.assertPortalCrm(req);
    await this.accountAccess.assertClient(req.organizationId, req.user, query.clientId);
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    const pagina = await this.service.findAll(req.organizationId, query.limit, query.offset, query.clientId, allowed, query.leadId);
    const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'crm');
    return { ...pagina, data: recortarFilasPorEmpresa(pagina.data, 'crm', niveles) };
  }

  @Get('segments')
  @RequiereArea('crm.contactos', 'ver')
  async segments(@Query('clientId') clientId: string | undefined, @Req() req: AuthenticatedRequest) {
    await this.assertPortalCrm(req);
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.service.segments(req.organizationId, clientId, allowed);
  }

  @Get(':id')
  @RequiereArea('crm.contactos', 'ver')
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.assertPortalCrm(req);
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    const contacto = await this.service.findOne(id, req.organizationId, allowed);
    const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'crm');
    return recortarFilasPorEmpresa([contacto], 'crm', niveles)[0];
  }

  /** Correo y teléfono de un contacto, con la misma constancia que en la ficha del lead. */
  @Get(':id/datos-protegidos')
  @RequiereArea('crm.contactos', 'ver')
  async datosProtegidos(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.assertPortalCrm(req);
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    const contacto = await this.service.findOne(id, req.organizationId, allowed);
    const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'crm');
    const ficha = contacto as unknown as Record<string, unknown>;
    const datos = Object.fromEntries(camposProtegidosDe('crm').filter(({ campo }) => campo in ficha).map(({ campo }) => [campo, ficha[campo] ?? null]));
    await exigirConstanciaDeRevelacion(this.audit, niveles.de(contacto.clientId), {
      organizationId: req.organizationId, actorId: req.user.id, entityType: 'contacts', entityId: id, campos: Object.keys(datos), ipAddress: req.ip,
    });
    return { id, datos };
  }

  /** Solo el papel en la cuenta y las notas. La identidad se edita en el lead. */
  @Patch(':id')
  @RequiereArea('crm.contactos', 'hacer')
  async update(@Param('id') id: string, @Body() dto: UpdateContactDto, @Req() req: AuthenticatedRequest) {
    await this.assertPortalCrm(req);
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    const contacto = await this.service.update(id, dto, req.organizationId, allowed);
    const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'crm');
    return recortarFilasPorEmpresa([contacto], 'crm', niveles)[0];
  }
}
