import { Controller, Get, Post, Body, Query, UseGuards, Req, Patch, Param, Put, Delete } from '@nestjs/common';
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
import { AdministradoresDeEmpresaService } from './administradores-de-empresa.service';

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
    private readonly administradores: AdministradoresDeEmpresaService,
  ) {}

  /**
   * Quiénes administran el equipo de una empresa, y si no queda nadie.
   *
   * Lo segundo importa tanto como lo primero: una empresa sin administrador no puede crear
   * cuentas, y hasta ahora eso solo se descubría cuando alguien llamaba a preguntar.
   */
  @Get('administran-equipo')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV, UserRole.CLIENT)
  @ApiOperation({ summary: 'Quiénes administran el equipo de una empresa' })
  async administranEquipo(@Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    const alcance = await this.administracion.alcance(req, clientId);
    const empresa = alcance.soloEmpresa ?? clientId;
    if (!empresa) return { clientId: null, userIds: [], sinAdministrador: false };
    const organizationId = req.organizationId || req.user.organizationId;
    const userIds = await this.administradores.quienesAdministran(organizationId, empresa);
    return { clientId: empresa, userIds, sinAdministrador: userIds.length === 0 };
  }

  /**
   * Las empresas cuyo equipo administra esa persona.
   *
   * Se lee por persona y no por empresa porque es lo que su ficha necesita: quien atiende
   * varios locales administra unos y en otros solo mira, y la ficha tiene que poder marcar
   * exactamente cuáles sin preguntar una por una.
   */
  @Get(':id/administra')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV, UserRole.CLIENT)
  @ApiOperation({ summary: 'Empresas cuyo equipo administra esta persona' })
  async empresasQueAdministra(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const alcance = await this.administracion.alcance(req);
    const organizationId = req.organizationId || req.user.organizationId;
    const empresas = await this.administradores.empresasQueAdministra(organizationId, id);
    // Quien administra una sola empresa no puede enterarse de las demás que atiende esa persona.
    return { clientIds: alcance.soloEmpresa ? empresas.filter((uno) => uno === alcance.soloEmpresa) : empresas };
  }

  /**
   * Concede o retira la administración del equipo de **una** empresa.
   *
   * Va empresa por empresa y no con una casilla única a propósito: la misma persona puede
   * atender tres locales y administrar uno. Una casilla sola obligaría a elegir entre darle
   * todos o ninguno, que es justo lo que no se quiere.
   */
  @Put(':id/administra/:clientId')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV, UserRole.CLIENT)
  @RequiresRecentAuth('conceder la administración del equipo de una empresa')
  @ApiOperation({ summary: 'Conceder la administración del equipo de una empresa' })
  async concederAdministracion(@Param('id') id: string, @Param('clientId') clientId: string, @Req() req: AuthenticatedRequest) {
    await this.definirAdministracion(id, clientId, true, req);
    return { clientId, administra: true };
  }

  @Delete(':id/administra/:clientId')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV, UserRole.CLIENT)
  @RequiresRecentAuth('retirar la administración del equipo de una empresa')
  @ApiOperation({ summary: 'Retirar la administración del equipo de una empresa' })
  async retirarAdministracion(@Param('id') id: string, @Param('clientId') clientId: string, @Req() req: AuthenticatedRequest) {
    await this.definirAdministracion(id, clientId, false, req);
    return { clientId, administra: false };
  }

  /**
   * El control común de las dos anteriores.
   *
   * La empresa pedida pasa por `alcance()`, que rechaza la que queda fuera: sin eso, quien
   * administra un local podría nombrarse administrador de otro cambiando el id de la dirección.
   */
  private async definirAdministracion(id: string, clientId: string, puede: boolean, req: AuthenticatedRequest): Promise<void> {
    const alcance = await this.administracion.alcance(req, clientId);
    this.administracion.asegurarDentro(alcance, { clientId, role: UserRole.CLIENT });
    await this.administradores.definir(
      req.organizationId || req.user.organizationId,
      id,
      clientId,
      puede,
      req.user.id,
    );
  }

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
    const organizationId = req.organizationId || req.user.organizationId;
    const creado = await this.createUser.execute({
      ...dto,
      // La empresa la pone el alcance, no el cuerpo: si no, bastaria cambiarla al enviar.
      ...(alcance.soloEmpresa ? { clientId: alcance.soloEmpresa, role: UserRole.CLIENT } : {}),
      organizationId,
      actorRole: req.user.role as UserRole,
    });
    /*
     * Decir qué será esa persona forma parte de crearla.
     *
     * La empresa sale de la cuenta recién creada y no del cuerpo: conceder la administración de
     * una empresa a la que esa persona no entra no le daría nada y ensuciaría los permisos.
     */
    const empresaDeLaCuenta = alcance.soloEmpresa ?? creado.clientId ?? undefined;
    if (dto.administraElEquipo && empresaDeLaCuenta) {
      await this.administradores.definir(organizationId, creado.id, empresaDeLaCuenta, true, req.user.id);
    }
    return creado;
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
    /*
     * Editar ya no concede ni retira la administración.
     *
     * Con una casilla en la ficha había que adivinar sobre qué empresa aplicaba, y cuando quien
     * editaba era la agencia —que no manda ninguna— no aplicaba sobre ninguna: la casilla se
     * marcaba, se guardaba y no pasaba nada. Ahora se concede empresa por empresa, con su
     * dirección propia, donde se ve a cuál corresponde.
     */
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
