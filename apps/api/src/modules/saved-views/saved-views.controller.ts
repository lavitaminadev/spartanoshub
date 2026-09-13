import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ModuleExempt } from '../../core/authorization/module-scope.decorator';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { SavedViewsService } from './saved-views.service';

class GuardarVistaDto {
  @IsString() @MinLength(3) @MaxLength(80) scope: string;
  @IsString() @MinLength(1) @MaxLength(60) name: string;
  @IsObject() filters: Record<string, unknown>;
  @IsOptional() @IsBoolean() shared?: boolean;
}

class CompartirVistaDto {
  @IsBoolean() shared: boolean;
}

@ApiTags('Vistas guardadas')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('saved-views')
/*
 * Transversal y sin restricción de cargo: la usan listas de varios módulos y guarda filtros, no
 * datos de ninguno. Cualquier sesión puede guardar sus propias vistas; lo que ve al aplicarlas lo
 * sigue decidiendo el permiso del módulo de cada lista.
 */
@ModuleExempt('Filtros con nombre de las listas; aplicarlos vuelve a pedir los datos con los permisos de cada módulo')
export class SavedViewsController {
  constructor(private readonly vistas: SavedViewsService) {}

  @Get()
  listar(@Req() req: AuthenticatedRequest, @Query('scope') scope: string) {
    return this.vistas.listar(req.user, scope);
  }

  @Post()
  guardar(@Req() req: AuthenticatedRequest, @Body() dto: GuardarVistaDto) {
    return this.vistas.guardar(req.user, dto);
  }

  @Patch(':id')
  compartir(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompartirVistaDto) {
    return this.vistas.compartir(req.user, id, dto.shared);
  }

  @Delete(':id')
  borrar(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.vistas.borrar(req.user, id);
  }
}
