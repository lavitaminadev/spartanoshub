import { Controller, Get, Post, Body, Query, UseGuards, Req, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CreateUserUseCase } from './create-user.use-case';
import { ListUsersUseCase } from './list-users.use-case';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { RequiresRecentAuth } from '../../core/auth/requires-recent-auth.decorator';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { UpdateUserUseCase } from './update-user.use-case';
import { ResetUserPasswordUseCase } from './reset-user-password.use-case';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';
import { AdministracionDelEquipoService } from './administracion-del-equipo.service';

/**
 * Endpoints de administración de usuarios.
 */
@ApiTags('Usuarios')
@Controller('users')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('users')
export class UsersController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly resetUserPassword: ResetUserPasswordUseCase,
    private readonly administracion: AdministracionDelEquipoService,
  ) {}

  /**
   * Crea un nuevo usuario dentro de la organización del solicitante.
   */
  /*
    La lista de cargos abre la puerta; el alcance lo decide el permiso.

    El cargo cliente entra en la lista porque una empresa puede administrar su propio equipo,
    pero entrar no es poder: `alcance()` exige el permiso de administrar personas en esa
    empresa y devuelve hasta dónde llega. Se conserva la lista porque es el contrato que se
    compara con el menú, y porque un cargo fuera de ella se rechaza antes de tocar nada.
  */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV, UserRole.CLIENT)
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  async create(@Body() dto: CreateUserDto, @Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    const alcance = await this.administracion.alcance(req, clientId);
    this.administracion.asegurarDentro(alcance, { clientId: dto.clientId ?? null, role: dto.role ?? null });
    return this.createUser.execute({
      ...dto,
      // La empresa la pone el alcance, no el cuerpo: si no, bastaria cambiarla al enviar.
      ...(alcance.soloEmpresa ? { clientId: alcance.soloEmpresa, role: UserRole.CLIENT } : {}),
      organizationId: req.organizationId || req.user.organizationId,
      actorRole: req.user.role as UserRole,
    });
  }

  /**
   * Lista los usuarios acotados a la organización del solicitante.
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV, UserRole.CLIENT)
  @ApiOperation({ summary: 'Listar usuarios' })
  async list(
    @Query('role') role: UserRole | undefined,
    @Query('clientId') clientId: string | undefined,
    @Query('q') q: string | undefined,
    @Query('isActive') isActive: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const normalizedIsActive = isActive == null
      ? undefined
      : isActive.toLowerCase() === 'true'
        ? true
        : isActive.toLowerCase() === 'false'
          ? false
          : undefined;

    const alcance = await this.administracion.alcance(req, clientId);
    return this.listUsers.execute({
      organizationId: req.organizationId || req.user.organizationId,
      // Acotado a su empresa y a las cuentas de empresa: el equipo de la agencia no es suyo.
      role: alcance.soloEmpresa ? UserRole.CLIENT : role,
      clientId: alcance.soloEmpresa ?? clientId,
      q,
      isActive: normalizedIsActive,
    });
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV, UserRole.CLIENT)
  // Cambiar el cargo de alguien cambia qué cuentas ve y qué puede hacer con ellas. Un
  // computador desbloqueado y desatendido alcanza para hacerlo si solo se pide sesión abierta.
  @RequiresRecentAuth('cambiar los datos o el cargo de una persona')
  @ApiOperation({ summary: 'Actualizar usuario' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    const alcance = await this.administracion.alcance(req, clientId);
    if (alcance.soloEmpresa) {
      const actual = await this.listUsers.execute({ organizationId: req.organizationId || req.user.organizationId, clientId: alcance.soloEmpresa });
      const destino = actual.find((persona) => persona.id === id);
      // Se comprueba la cuenta que ya existe, no lo que viene en el cuerpo: cambiar de empresa
      // a alguien ajeno seria moverlo al alcance propio y editarlo en el mismo paso.
      this.administracion.asegurarDentro(alcance, { clientId: destino?.clientId ?? null, role: destino?.role ?? null });
    }
    return this.updateUser.execute({
      id,
      organizationId: req.organizationId || req.user.organizationId,
      actorId: req.user.id,
      actorRole: req.user.role as UserRole,
      ...dto,
      ...(alcance.soloEmpresa ? { clientId: alcance.soloEmpresa, role: UserRole.CLIENT } : {}),
    });
  }

  @Post(':id/reset-password')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.DEV)
  // Entrega una contraseña temporal de otra cuenta: es tomar el control de esa cuenta.
  @RequiresRecentAuth('restablecer la contraseña de otra persona')
  @ApiOperation({ summary: 'Generar una contraseña temporal y revocar sesiones activas' })
  resetPassword(@Param('id') id: string, @Body() dto: ResetUserPasswordDto, @Req() req: AuthenticatedRequest) {
    return this.resetUserPassword.execute({
      id,
      organizationId: req.organizationId || req.user.organizationId,
      actorRole: req.user.role as UserRole,
      sendEmail: dto.sendEmail,
    });
  }
}
