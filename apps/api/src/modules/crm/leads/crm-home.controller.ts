import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../../core/authorization/roles.decorator';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { CrmHomeService } from './crm-home.service';

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
@Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
@ModuleScope('crm')
export class CrmHomeController {
  constructor(private readonly home: CrmHomeService) {}

  @Get()
  @ApiOperation({ summary: 'Avisos y carga del equipo al entrar al CRM' })
  async get(@Req() req: AuthenticatedRequest, @Query('coolingDays') coolingDays?: string) {
    // El plazo se acota acá y no solo en la pantalla: un valor absurdo llegado por la dirección
    // no debe poder pedir un rango que recorra toda la tabla.
    const dias = Math.min(Math.max(Number(coolingDays) || 7, 1), 90);
    return this.home.home(req.organizationId!, dias);
  }
}
