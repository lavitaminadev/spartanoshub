import { Controller, Get, Patch, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ContactsService } from './contacts.service';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { Roles } from '../../../core/authorization/roles.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import type { AuthenticatedRequest } from '@shared/types/request';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';

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
@Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
@ModuleScope('crm')
export class ContactsController {
  constructor(
    private service: ContactsService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  @Get()
  async findAll(@Query() query: ListContactsDto, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, query.clientId);
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.service.findAll(req.organizationId, query.limit, query.offset, query.clientId, allowed);
  }

  @Get('segments')
  async segments(@Query('clientId') clientId: string | undefined, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.service.segments(req.organizationId, clientId, allowed);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.service.findOne(id, req.organizationId, allowed);
  }

  /** Solo el papel en la cuenta y las notas. La identidad se edita en el lead. */
  @Patch(':id')
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateContactDto, @Req() req: AuthenticatedRequest) {
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.service.update(id, dto, req.organizationId, allowed);
  }
}
