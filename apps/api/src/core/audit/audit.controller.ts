import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../authorization/roles.decorator';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { AuditService } from './audit.service';
import { ModuleScope } from '../authorization/module-scope.decorator';

@Controller('audit')
@UseGuards(AuthGuard('jwt'))
// La dirección comercial opera el CRM a diario, así que necesita ver el historial de sus
// propios registros: sin eso, cada duda sobre quién cambió un lead escala a administración.
@Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR)
@ModuleScope('governance')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /**
   * @param entityId - Historial de un registro concreto, que es la consulta que se hace en la
   *   práctica: "quién tocó este contacto y qué cambió".
   */
  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.search(req.organizationId!, { entityType, entityId, action, actorId, limit: limit ? Number(limit) : undefined });
  }
}
