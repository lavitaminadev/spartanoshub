import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Roles } from '../../core/authorization/roles.decorator';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';
import { RequiresPermission } from '../../core/authorization/requires-permission.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { CampanasService } from './campanas.service';

class CrearCampanaDto {
  @IsString() @MinLength(3) @MaxLength(200) asunto: string;
  @IsString() @MinLength(3) cuerpo: string;
  /** Vacío o `agencia` es la lista propia de Espartanos. */
  @IsOptional() @IsString() clientId?: string | null;
  /** Código de un cupón que ya exista en Cupones: de esta misma empresa, activo y sin vencer. */
  @IsOptional() @IsString() @MaxLength(40) cupon?: string | null;
  /** `lista` son los suscritos de la empresa; `administradores`, las cuentas que la administran. */
  @IsOptional() @IsIn(['lista', 'administradores']) destino?: 'lista' | 'administradores';
}

class EditarCampanaDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(200) asunto?: string;
  @IsOptional() @IsString() @MinLength(3) cuerpo?: string;
  @IsOptional() @IsString() @MaxLength(40) cupon?: string | null;
  @IsOptional() @IsIn(['lista', 'administradores']) destino?: 'lista' | 'administradores';
}

/**
 * Escribir a la lista. Sólo la agencia.
 *
 * Una cuenta de empresa mira su lista y se la descarga para escribir por su cuenta; enviar desde
 * aquí no. No es desconfianza: quien aprieta el botón responde de que cada dirección de esa lista
 * tenga respaldo, y ese respaldo lo lleva la agencia. Por eso el cargo cliente no aparece en
 * ningún `@Roles` de este controlador ni tiene nivel para el verbo que hace falta.
 */
@ApiTags('marketing')
@Controller('marketing/campanas')
@ModuleScope('marketing')
@Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.DEV)
export class CampanasController {
  constructor(private readonly campanas: CampanasService) {}

  @Get()
  @ApiOperation({ summary: 'Campañas escritas, enviadas y en borrador' })
  listar(@Req() req: AuthenticatedRequest) {
    return this.campanas.listar(req.organizationId || req.user.organizationId);
  }

  @Get('destinatarios')
  @ApiOperation({ summary: 'A cuántos llegaría la campaña si se enviara ahora' })
  async destinatarios(
    @Req() req: AuthenticatedRequest,
    @Query('empresa') empresa?: string,
    @Query('destino') destino?: string,
  ) {
    return this.campanas.destinatarios(
      req.organizationId || req.user.organizationId,
      empresa,
      destino === 'administradores' ? 'administradores' : 'lista',
    );
  }

  /**
   * Componer el correo para verlo, sin guardarlo ni enviarlo.
   *
   * Recibe el texto que se está escribiendo y no un id: sirve para mirar un borrador antes de
   * guardarlo, que es justo cuando hace falta.
   */
  @Post('vista-previa')
  @ApiOperation({ summary: 'Ver cómo queda la campaña, sin enviarla' })
  vistaPrevia(@Body() dto: EditarCampanaDto) {
    return this.campanas.vistaPrevia(dto.asunto ?? '', dto.cuerpo ?? '');
  }

  @Post()
  @ApiOperation({ summary: 'Escribir una campaña, en borrador' })
  crear(@Req() req: AuthenticatedRequest, @Body() dto: CrearCampanaDto) {
    return this.campanas.crear({
      organizationId: req.organizationId || req.user.organizationId,
      clientId: dto.clientId,
      asunto: dto.asunto,
      cuerpo: dto.cuerpo,
      cupon: dto.cupon,
      destino: dto.destino,
      createdBy: req.user.id,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Corregir una campaña que todavía no se ha enviado' })
  editar(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: EditarCampanaDto) {
    return this.campanas.editar(id, req.organizationId || req.user.organizationId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Descartar un borrador' })
  async borrar(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.campanas.borrar(id, req.organizationId || req.user.organizationId);
    return { borrada: true };
  }

  /**
   * El envío.
   *
   * Exige `manage` y no el `edit` que le tocaría al verbo: mandar un correo a una lista entera no
   * se deshace, y no es lo mismo que escribir el borrador. Quien puede redactar no manda por eso.
   */
  @Post(':id/enviar')
  @RequiresPermission('marketing', 'manage')
  @ApiOperation({ summary: 'Poner la campaña en cola para salir' })
  enviar(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.campanas.enviar(id, req.organizationId || req.user.organizationId);
  }

  /** Cómo va una campaña que está saliendo. La pantalla lo pregunta mientras dura. */
  @Get(':id/avance')
  @ApiOperation({ summary: 'Avance del envío de una campaña' })
  avance(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.campanas.avance(id, req.organizationId || req.user.organizationId);
  }
}
