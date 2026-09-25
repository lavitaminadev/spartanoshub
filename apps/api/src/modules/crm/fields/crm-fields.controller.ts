import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, IsUUID } from 'class-validator';
import { TIPOS_DE_CAMPO } from '@espartanos/shared';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { RequiresPermission } from '../../../core/authorization/requires-permission.decorator';
import { Roles } from '../../../core/authorization/roles.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../../shared/types/request';
import { CrmFieldsService } from './crm-fields.service';

const TIPOS = TIPOS_DE_CAMPO.map((tipo) => tipo.value);

class CrearCampoDto {
  /** Empresa dueña del campo. Sin ella, el campo es de todas: es como funcionó siempre. */
  @IsOptional() @IsUUID() clientId?: string;
  @IsIn(['lead', 'contact', 'opportunity']) entity: string;
  @IsString() @MinLength(1) @MaxLength(80) label: string;
  @IsOptional() @IsString() @MaxLength(40) key?: string;
  @IsIn(TIPOS) type: string;
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
  @IsOptional() @IsBoolean() required?: boolean;
  /*
   * Las preguntas de Meta se declaran al crear el campo, no después.
   *
   * Sólo se podían añadir editándolo, así que conectar un campo con el formulario del anuncio
   * eran dos pasos en dos momentos; quien no volvía a abrirlo tenía un campo que nunca se
   * llenaba solo y no había nada que lo dijera.
   */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(120, { each: true }) metaQuestions?: string[];
}

class EditarCampoDto {
  /** Preguntas de Meta que llenan el campo. Lista vacía: deja de recibir de los formularios. */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(120, { each: true }) metaQuestions?: string[];
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) label?: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsInt() @Min(0) position?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
  @IsOptional() @IsIn(TIPOS) type?: string;
}

class ArchivarCampoDto {
  @IsBoolean() archivado: boolean;
}

/**
 * Quién define los campos del CRM.
 *
 * Leer las definiciones lo necesita cualquiera que abra una ficha. Crearlas, cambiarlas o
 * archivarlas cambia la forma de los datos para toda la organización: queda en manos de quien
 * administra el CRM, y nunca del portal de una empresa cliente.
 */
const QUIEN_DEFINE = [UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR];

@ApiTags('CRM · Campos propios')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('crm/fields')
@ModuleScope('crm')
export class CrmFieldsController {
  constructor(private readonly campos: CrmFieldsService) {}

  @Get()
  @ApiOperation({ summary: 'Campos propios de un tipo de registro' })
  /** @param clientId - Empresa que se está mirando: devuelve los campos de todas más los suyos. */
  listar(@Req() req: AuthenticatedRequest, @Query('entity') entity: string, @Query('archivados') archivados?: string, @Query('clientId') clientId?: string) {
    return this.campos.listar(req.organizationId!, entity, archivados === 'true', clientId || undefined);
  }

  @Post()
  @Roles(...QUIEN_DEFINE)
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Crear un campo propio' })
  crear(@Req() req: AuthenticatedRequest, @Body() dto: CrearCampoDto) {
    return this.campos.crear(req.organizationId!, req.user.id, dto);
  }

  @Patch(':id')
  @Roles(...QUIEN_DEFINE)
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Cambiar nombre, orden, opciones o tipo de un campo' })
  editar(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EditarCampoDto) {
    return this.campos.actualizar(req.organizationId!, id, dto);
  }

  @Patch(':id/archivo')
  @Roles(...QUIEN_DEFINE)
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Archivar o desarchivar un campo, sin borrar lo guardado' })
  archivar(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ArchivarCampoDto) {
    return this.campos.archivar(req.organizationId!, id, dto.archivado);
  }
}
