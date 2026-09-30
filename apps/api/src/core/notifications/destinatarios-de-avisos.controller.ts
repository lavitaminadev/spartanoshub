import {
  Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles } from '../authorization/roles.decorator';
import { ModuleScope } from '../authorization/module-scope.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { AccountAccessService } from '../client-scope/account-access.service';
import { DestinatariosDeAvisosService } from './destinatarios-de-avisos.service';
import { TIPOS_DE_AVISO, TIPOS_DE_AVISO_VALIDOS } from './destinatario-de-avisos.entity';

class GuardarDestinatarioDto {
  @IsEmail({}, { message: 'La dirección de correo no es válida' }) email: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(80) cargo?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsIn(TIPOS_DE_AVISO_VALIDOS, { each: true }) tipos?: string[];
}

/**
 * Las casillas del equipo de un local que reciben avisos.
 *
 * Quien atiende no tiene por qué tener cuenta: un garzón o una cajera reciben un aviso y hacen su
 * trabajo. Esta pantalla es la que permite anotarlos sin inventarles un usuario, y decidir qué
 * avisos le toca a cada uno —el de grupos lleva el teléfono de quien pidió el evento, y eso no
 * tiene por qué verlo todo el turno—.
 *
 * Una cuenta de empresa mantiene la de su propio local y ninguna otra. Es su equipo: pedirle a la
 * agencia que agregue a un garzón nuevo cada vez es lo que hace que la lista quede vieja.
 */
@ApiTags('notifications')
@Controller('avisos/destinatarios')
@ModuleScope('reservations')
@Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV, UserRole.CLIENT)
export class DestinatariosDeAvisosController {
  constructor(
    private readonly destinatarios: DestinatariosDeAvisosService,
    private readonly acceso: AccountAccessService,
  ) {}

  /**
   * La empresa sobre la que se actúa, comprobada contra lo que esta cuenta alcanza.
   *
   * Nunca se confía en el `clientId` que llega: es el dato que decide de qué equipo se está
   * hablando, y con él se leen y se borran direcciones de trabajadores de otra empresa. Una cuenta
   * de empresa queda encerrada en la suya diga lo que diga la petición.
   */
  private async empresaDe(req: AuthenticatedRequest, pedida?: string): Promise<string> {
    const organizationId = req.organizationId || req.user.organizationId;
    if (req.user.role === UserRole.CLIENT) {
      if (!req.user.clientId) throw new ForbiddenException('La cuenta de empresa no tiene una empresa asociada');
      return req.user.clientId;
    }
    if (!pedida) throw new ForbiddenException('Falta indicar de qué empresa es el equipo');
    // `undefined` significa que alcanza todas: la agencia y el equipo interno.
    const alcanzables = await this.acceso.allowedClientIds(organizationId, req.user);
    if (alcanzables && !alcanzables.includes(pedida)) {
      throw new ForbiddenException('Esta cuenta no alcanza esa empresa');
    }
    return pedida;
  }

  /** Los tipos de aviso que se pueden repartir, para que la pantalla no los repita por su cuenta. */
  @Get('tipos')
  @ApiOperation({ summary: 'Tipos de aviso que puede recibir el equipo' })
  tipos() {
    return {
      data: TIPOS_DE_AVISO_VALIDOS.map((clave) => ({ clave, etiqueta: TIPOS_DE_AVISO[clave].etiqueta })),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Casillas del equipo de un local' })
  async listar(@Req() req: AuthenticatedRequest, @Query('empresa') empresa?: string) {
    const clientId = await this.empresaDe(req, empresa);
    const data = await this.destinatarios.listar(req.organizationId || req.user.organizationId, clientId);
    return { data };
  }

  @Post()
  @ApiOperation({ summary: 'Anotar o corregir una casilla del equipo' })
  async guardar(
    @Req() req: AuthenticatedRequest,
    @Body() dto: GuardarDestinatarioDto,
    @Query('empresa') empresa?: string,
  ) {
    const clientId = await this.empresaDe(req, empresa);
    return this.destinatarios.guardar(
      req.organizationId || req.user.organizationId,
      clientId,
      dto,
      req.user.id,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Quitar una casilla del equipo' })
  async borrar(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('empresa') empresa?: string,
  ) {
    const clientId = await this.empresaDe(req, empresa);
    await this.destinatarios.borrar(req.organizationId || req.user.organizationId, clientId, id);
    return { borrada: true };
  }
}
