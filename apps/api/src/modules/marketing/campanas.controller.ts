import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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
}

class EditarCampanaDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(200) asunto?: string;
  @IsOptional() @IsString() @MinLength(3) cuerpo?: string;
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
  async destinatarios(@Req() req: AuthenticatedRequest, @Query('empresa') empresa?: string) {
    const total = await this.campanas.destinatarios(req.organizationId || req.user.organizationId, empresa);
    return { total };
  }

  @Post()
  @ApiOperation({ summary: 'Escribir una campaña, en borrador' })
  crear(@Req() req: AuthenticatedRequest, @Body() dto: CrearCampanaDto) {
    return this.campanas.crear({
      organizationId: req.organizationId || req.user.organizationId,
      clientId: dto.clientId,
      asunto: dto.asunto,
      cuerpo: dto.cuerpo,
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
  @ApiOperation({ summary: 'Enviar la campaña a los suscritos de esa lista' })
  enviar(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.campanas.enviar(id, req.organizationId || req.user.organizationId);
  }
}
