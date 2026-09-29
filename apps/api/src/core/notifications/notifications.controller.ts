import { Controller, Get, Put, Param, Req, NotFoundException, Delete, Optional } from '@nestjs/common';
import { AccountAccessService } from '../client-scope/account-access.service';
import { ClientCapabilityService } from '../client-scope/client-capability.service';
import { avisosVisibles } from './notificaciones-visibles';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Roles } from '../authorization/roles.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { ModuleExempt } from '../authorization/module-scope.decorator';

@ApiTags('Notificaciones')
@Controller('notifications')
@Roles(...Object.values(UserRole))
@ModuleExempt('Autoservicio: cada persona ve y marca sus propios avisos')
export class NotificationsController {
  constructor(
    private readonly service: NotificationService,
    @Optional() private readonly accesos?: AccountAccessService,
    @Optional() private readonly servicios?: ClientCapabilityService,
  ) {}

  private canReadSystemNotifications(req: AuthenticatedRequest) {
    return req.user.role === UserRole.ADMIN;
  }

  @Get()
  @ApiOperation({ summary: 'Listar notificaciones del usuario' })
  async findAll(@Req() req: AuthenticatedRequest) {
    const organizationId = req.organizationId || req.user.organizationId;
    const avisos = await this.service.findByUser(organizationId, req.user.id, this.canReadSystemNotifications(req));
    return avisosVisibles(avisos, organizationId, req.user, this.accesos, this.servicios);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Obtener cantidad de notificaciones no leídas' })
  async unreadCount(@Req() req: AuthenticatedRequest) {
    // Se cuentan las mismas que se muestran: un número que no calza con la lista parece un error.
    const organizationId = req.organizationId || req.user.organizationId;
    const noLeidas = await this.service.unreadByUser(organizationId, req.user.id, this.canReadSystemNotifications(req));
    return { unread: (await avisosVisibles(noLeidas, organizationId, req.user, this.accesos, this.servicios)).length };
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leidas' })
  markAllAsRead(@Req() req: AuthenticatedRequest) {
    return this.service.markAllAsRead(req.organizationId || req.user.organizationId, req.user.id, this.canReadSystemNotifications(req));
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  async markAsRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const notif = await this.service.markAsRead(req.organizationId || req.user.organizationId, id, req.user.id, this.canReadSystemNotifications(req));
    if (!notif) throw new NotFoundException('Notification not found');
    return notif;
  }
  @Delete('read')
  @ApiOperation({ summary: 'Borrar las notificaciones ya leidas' })
  removeRead(@Req() req: AuthenticatedRequest) {
    return this.service.removeRead(req.organizationId || req.user.organizationId, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Borrar una notificacion' })
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const borrada = await this.service.remove(req.organizationId || req.user.organizationId, id, req.user.id);
    if (!borrada) throw new NotFoundException('Notification not found');
    return { deleted: true };
  }
}
