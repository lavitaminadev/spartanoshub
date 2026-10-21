import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { JuegoDeAreas, JuegoDeDatos } from '@espartanos/shared';
import { Roles } from '../../../core/authorization/roles.decorator';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { RequiresRecentAuth } from '../../../core/auth/requires-recent-auth.decorator';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import type { AuthenticatedRequest } from '../../../shared/types/request';
import { UserRole } from '../../organizations/user-role.enum';
import { AdministracionDelEquipoService } from '../administracion-del-equipo.service';
import { AsignarPerfilDto, InvitarDto, PerfilDto } from './perfiles.dto';
import { InvitacionesService } from './invitaciones.service';
import { PerfilesService, type ContextoDePerfiles } from './perfiles.service';
import { RequiereArea } from '../../../core/authorization/requiere-area.decorator';

const CARGOS = [UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV, UserRole.CLIENT] as const;

/**
 * Perfiles de la empresa, su reparto y la invitación al equipo.
 *
 * Todo se hace sobre **una** empresa, que fija `alcance()`: quien administra su empresa sólo
 * toca la suya por mucho que escriba otra en la dirección. La agencia debe nombrar la empresa y
 * la alcanzar.
 */
@ApiTags('Perfiles')
@Controller('perfiles')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('users')
export class PerfilesController {
  constructor(
    private readonly perfiles: PerfilesService,
    private readonly invitaciones: InvitacionesService,
    private readonly administracion: AdministracionDelEquipoService,
    private readonly accesos: AccountAccessService,
  ) {}

  private async contexto(req: AuthenticatedRequest, clientId?: string): Promise<ContextoDePerfiles> {
    const alcance = await this.administracion.alcance(req, clientId);
    const organizationId = req.organizationId || req.user.organizationId;
    const empresa = alcance.soloEmpresa ?? clientId;
    if (!empresa) throw new BadRequestException('Elige la empresa');
    // El 404 de la agencia sobre una empresa que no alcanza no confirma que exista.
    if (!alcance.soloEmpresa) await this.accesos.assertClient(organizationId, req.user, empresa);
    return { organizationId, clientId: empresa, actorId: req.user.id, esAgencia: !alcance.soloEmpresa, ip: req.ip };
  }

  @Get()
  @RequiereArea('users.equipo', 'ver')
  @Roles(...CARGOS)
  @ApiOperation({ summary: 'Perfiles de la empresa, con cuántas personas usa cada uno' })
  async listar(@Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    return { data: await this.perfiles.listar(await this.contexto(req, clientId)) };
  }

  @Get('asignaciones')
  @RequiereArea('users.equipo', 'ver')
  @Roles(...CARGOS)
  @ApiOperation({ summary: 'Qué perfil tiene cada persona de la empresa' })
  async asignaciones(@Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    return { data: await this.perfiles.asignacionesDeLaEmpresa(await this.contexto(req, clientId)) };
  }

  /**
   * Qué ve y qué puede hacer una persona, y de dónde le viene cada cosa.
   *
   * Es lo que permite comprobar lo que se repartió, y la pieza con la que se contesta «por qué
   * esta persona ve esto» sin entrar a la base. Pide `users.equipo` en `ver`: quien administra
   * el equipo puede revisarlo, y nadie más.
   */
  @Get('que-ve/:userId')
  @RequiereArea('users.equipo', 'ver')
  @Roles(...CARGOS)
  @ApiOperation({ summary: 'Qué ve una persona en esta empresa, y por qué' })
  async queVe(@Req() req: AuthenticatedRequest, @Param('userId') userId: string, @Query('clientId') clientId?: string) {
    return this.perfiles.queVe(await this.contexto(req, clientId), userId);
  }

  @Get('reingresos')
  @RequiereArea('users.equipo', 'ver')
  @Roles(...CARGOS)
  @ApiOperation({ summary: 'Quiénes reingresaron al equipo, cuándo y por qué' })
  async reingresos(@Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    return { data: await this.perfiles.reingresos(await this.contexto(req, clientId)) };
  }

  @Get('texto-de-confidencialidad')
  @RequiereArea('users.equipo', 'ver')
  @Roles(...CARGOS)
  @ApiOperation({ summary: 'Texto que se acepta al dar acceso a datos de categoría especial' })
  async texto(@Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    const ctx = await this.contexto(req, clientId);
    return this.perfiles.textoDeConfidencialidad(ctx.organizationId);
  }

  @Post('sugeridos')
  @RequiereArea('users.perfiles', 'hacer')
  @Roles(...CARGOS)
  @ApiOperation({ summary: 'Copiar los perfiles sugeridos de los módulos que la empresa tiene encendidos' })
  async sugeridos(@Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    const ctx = await this.contexto(req, clientId);
    return { copiados: await this.perfiles.sembrarSugeridos(ctx.organizationId, ctx.clientId) };
  }

  @Get('invitaciones')
  @RequiereArea('users.equipo', 'ver')
  @Roles(...CARGOS)
  @ApiOperation({ summary: 'Invitaciones pendientes de la empresa' })
  async pendientes(@Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    return { data: await this.invitaciones.pendientes(await this.contexto(req, clientId)) };
  }

  /** Responde lo mismo exista o no la cuenta del correo; ver `InvitacionesService`. */
  @Post('invitaciones')
  @RequiereArea('users.invitar', 'hacer')
  @Roles(...CARGOS)
  @ApiOperation({ summary: 'Invitar por correo, eligiendo el perfil en el mismo paso' })
  async invitar(@Req() req: AuthenticatedRequest, @Body() dto: InvitarDto, @Query('clientId') clientId?: string) {
    const ctx = await this.contexto(req, clientId);
    const respuesta = await this.invitaciones.invitar(ctx, dto, req.user.id);
    return { ...respuesta, mensaje: 'Invitación enviada' };
  }

  @Delete('invitaciones/:id')
  @RequiereArea('users.invitar', 'hacer')
  @Roles(...CARGOS)
  @ApiOperation({ summary: 'Cancelar una invitación pendiente' })
  async cancelar(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Query('clientId') clientId?: string) {
    await this.invitaciones.cancelar(await this.contexto(req, clientId), id);
    return { cancelada: true };
  }

  @Put('asignaciones/:userId')
  @RequiereArea('users.perfiles', 'hacer')
  @Roles(...CARGOS)
  @ApiOperation({ summary: 'Asignar un perfil a una persona de la empresa' })
  async asignar(@Req() req: AuthenticatedRequest, @Param('userId') userId: string, @Body() dto: AsignarPerfilDto, @Query('clientId') clientId?: string) {
    await this.perfiles.asignar(await this.contexto(req, clientId), userId, dto.perfilId ?? null);
    return { userId, perfilId: dto.perfilId ?? null };
  }

  @Delete('equipo/:userId')
  @RequiereArea('users.invitar', 'hacer')
  @Roles(...CARGOS)
  @RequiresRecentAuth('quitar a una persona del equipo')
  @ApiOperation({ summary: 'Retirar (o vetar) a una persona del equipo de esta empresa, con su motivo' })
  async quitar(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Query('motivo') motivo: string,
    @Query('vetar') vetar?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.perfiles.quitarDelEquipo(await this.contexto(req, clientId), userId, motivo, vetar === '1' || vetar === 'true');
  }

  @Post()
  @RequiereArea('users.perfiles', 'hacer')
  @Roles(...CARGOS)
  @ApiOperation({ summary: 'Crear un perfil' })
  async crear(@Req() req: AuthenticatedRequest, @Body() dto: PerfilDto, @Query('clientId') clientId?: string) {
    return this.perfiles.crear(await this.contexto(req, clientId), entrada(dto));
  }

  @Put(':id')
  @RequiereArea('users.perfiles', 'hacer')
  @Roles(...CARGOS)
  @ApiOperation({ summary: 'Editar un perfil; cambia lo que ven quienes lo usan' })
  async editar(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: PerfilDto, @Query('clientId') clientId?: string) {
    return this.perfiles.actualizar(await this.contexto(req, clientId), id, entrada(dto));
  }

  @Delete(':id')
  @RequiereArea('users.perfiles', 'hacer')
  @Roles(...CARGOS)
  @ApiOperation({ summary: 'Borrar un perfil; si alguien lo usa hay que decir a quién pasan' })
  async borrar(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Query('reasignarA') reasignarA?: string, @Query('clientId') clientId?: string) {
    return this.perfiles.borrar(await this.contexto(req, clientId), id, reasignarA || undefined);
  }
}

function entrada(dto: PerfilDto) {
  return {
    nombre: dto.nombre,
    descripcion: dto.descripcion,
    areas: dto.areas as JuegoDeAreas,
    datosProtegidos: (dto.datosProtegidos ?? {}) as JuegoDeDatos,
    aceptacion: dto.aceptacion,
    confirmaPersonas: dto.confirmaPersonas,
  };
}
