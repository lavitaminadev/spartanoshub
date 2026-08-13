import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { ServiceRequestsService } from './service-requests.service';
import { CreateServiceRequestDto, ResolveServiceRequestDto } from './dto/service-request.dto';
import type { AuthenticatedRequest } from '../../shared/types/request';

@ApiTags('Solicitudes')
@Controller('service-requests')
export class ServiceRequestsController {
  constructor(private readonly service: ServiceRequestsService) {}

  /** Crea una solicitud desde la página pública (login → "Solicitudes"). */
  @Post()
  async create(@Body() dto: CreateServiceRequestDto) {
    if (dto.website) return { id: 'spam', status: 'ignored' };
    return this.service.createPublic({
      type: dto.type,
      requesterName: dto.requesterName,
      requesterEmail: dto.requesterEmail,
      requesterRut: dto.requesterRut,
      requesterPhone: dto.requesterPhone,
      message: dto.message,
      privacyAccepted: dto.privacyAccepted,
    });
  }

  /** Consulta pública del historial por correo + RUT. */
  @Get('status')
  status(@Query('email') email: string, @Query('rut') rut?: string) {
    return this.service.findByStatus(email ?? '', rut);
  }

  /** Panel de administración: lista de solicitudes. */
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.DEV)
  @Get()
  list(@Req() req: AuthenticatedRequest, @Query('status') status?: string, @Query('type') type?: string) {
    return this.service.list(req.organizationId!, { status, type });
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.DEV)
  @Get(':id')
  getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.getOne(req.organizationId!, id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.DEV)
  @Put(':id')
  resolve(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ResolveServiceRequestDto) {
    return this.service.resolve(req.organizationId!, id, { id: req.user.id, name: req.user.name }, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.DEV)
  @Post(':id/anonymize')
  anonymize(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.anonymizeByIdentity(req.organizationId!, id, { id: req.user.id, name: req.user.name });
  }
}
