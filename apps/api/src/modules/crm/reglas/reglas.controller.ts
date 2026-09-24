import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ReglasService, type DatosDeRegla } from './reglas.service';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { RequiresPermission } from '../../../core/authorization/requires-permission.decorator';
import type { AuthenticatedRequest } from '../../../shared/types/request';

class CondicionDto {
  @IsIn(['respuestas', 'pregunta', 'campo', 'fuente', 'responsable', 'monto', 'campana']) donde: string;
  @IsOptional() @IsString() @MaxLength(200) clave?: string;
  @IsIn(['contiene', 'no_contiene', 'es', 'no_es', 'vacio', 'no_vacio', 'mayor_que', 'menor_que']) comparador: string;
  @IsOptional() @IsString() @MaxLength(300) valor?: string;
}

class TareaDto {
  @IsString() @MaxLength(200) titulo: string;
  @IsOptional() enHoras?: number;
}

class AccionesDto {
  @IsOptional() @IsIn(['green', 'yellow', 'red']) semaforo?: 'green' | 'yellow' | 'red';
  @IsOptional() @IsString() @MaxLength(40) calificacion?: string;
  @IsOptional() @IsString() @MaxLength(40) etapa?: string;
  @IsOptional() @IsUUID() responsable?: string;
  @IsOptional() @IsString() @MaxLength(200) descartarMotivo?: string;
  @IsOptional() @ValidateNested() @Type(() => TareaDto) tarea?: TareaDto;
  @IsOptional() @IsUUID() avisarA?: string;
  @IsOptional() @IsString() @MaxLength(500) nota?: string;
  @IsOptional() @IsString() @MaxLength(40) guardarEnCampo?: string;
}

class GuardarReglaDto {
  @IsString() @MaxLength(120) nombre: string;
  @IsOptional() @IsIn(['todas', 'alguna']) unir?: 'todas' | 'alguna';
  // El tope evita que una regla se vuelva ilegible; con más de diez nadie sabe qué hace.
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => CondicionDto) condiciones?: CondicionDto[];
  @IsOptional() @ValidateNested() @Type(() => AccionesDto) acciones?: AccionesDto;
  @IsOptional() @IsBoolean() activa?: boolean;
  @IsOptional() @IsBoolean() automatica?: boolean;
}

class OrdenDto {
  @IsArray() @ArrayMaxSize(60) @IsUUID('4', { each: true }) ids: string[];
}

class CopiarDto {
  @IsUUID() desdeClientId: string;
}

class AplicarDto {
  @IsArray() @ArrayMaxSize(500) @IsUUID('4', { each: true }) leadIds: string[];
}

/**
 * Las reglas que califican leads solas.
 *
 * Todo cuelga de una empresa: calificar es la decisión más propia de cada negocio, y una regla
 * sin dueño calificaría empresas que nadie revisó. La empresa llega por `clientId` y el alcance
 * de quien pregunta la acota, igual que en el resto del CRM.
 */
@ApiTags('CRM · Reglas de calificación')
@Controller('crm/reglas')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('crm')
export class ReglasController {
  constructor(private readonly reglas: ReglasService) {}

  @Get()
  @RequiresPermission('crm', 'view')
  @ApiOperation({ summary: 'Reglas de una empresa, en orden' })
  listar(@Req() req: AuthenticatedRequest, @Query('clientId') clientId: string, @Query('archivadas') archivadas?: string) {
    return this.reglas.listar(req.organizationId, this.empresa(req, clientId), archivadas === 'true');
  }

  @Get('preguntas')
  @RequiresPermission('crm', 'view')
  @ApiOperation({ summary: 'Preguntas que están llegando, con sus respuestas y cuántos las contestan' })
  preguntas(@Req() req: AuthenticatedRequest, @Query('clientId') clientId: string) {
    return this.reglas.preguntasQueLlegan(req.organizationId, this.empresa(req, clientId));
  }

  @Post('probar')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Cuántos leads calzarían con una regla, sin tocarlos' })
  probar(@Req() req: AuthenticatedRequest, @Query('clientId') clientId: string, @Body() dto: GuardarReglaDto) {
    return this.reglas.cuantosCalzan(req.organizationId, this.empresa(req, clientId), dto as DatosDeRegla);
  }

  /**
   * Aplica las reglas a los leads que se eligieron en el tablero.
   *
   * Es lo que permite estrenar una regla sobre los leads que ya entraron, y probarla sobre unos
   * pocos antes de dejarla correr sola. Corren todas las vivas, automáticas o no: aplicar a mano
   * es precisamente pedirlo.
   */
  @Post('aplicar')
  @RequiresPermission('crm', 'edit')
  @ApiOperation({ summary: 'Aplicar las reglas a los leads elegidos' })
  aplicar(@Req() req: AuthenticatedRequest, @Query('clientId') clientId: string, @Body() dto: AplicarDto) {
    return this.reglas.aplicarYGuardar(req.organizationId, this.empresa(req, clientId), dto.leadIds);
  }

  @Post()
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Crear una regla' })
  crear(@Req() req: AuthenticatedRequest, @Query('clientId') clientId: string, @Body() dto: GuardarReglaDto) {
    return this.reglas.crear(req.organizationId, this.empresa(req, clientId), dto as DatosDeRegla, req.user.id);
  }

  @Put('orden')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Reordenar: manda la primera que calza' })
  reordenar(@Req() req: AuthenticatedRequest, @Query('clientId') clientId: string, @Body() dto: OrdenDto) {
    return this.reglas.reordenar(req.organizationId, this.empresa(req, clientId), dto.ids);
  }

  @Post('copiar')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Copiar las reglas de otra empresa, apagadas' })
  async copiar(@Req() req: AuthenticatedRequest, @Query('clientId') clientId: string, @Body() dto: CopiarDto) {
    const copiadas = await this.reglas.copiarDesde(req.organizationId, dto.desdeClientId, this.empresa(req, clientId), req.user.id);
    return { copiadas };
  }

  @Put(':id')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Editar una regla' })
  editar(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: GuardarReglaDto) {
    return this.reglas.editar(req.organizationId, id, dto as DatosDeRegla);
  }

  @Put(':id/activa')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Encender o apagar' })
  activar(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: { activa: boolean }) {
    return this.reglas.activar(req.organizationId, id, dto?.activa === true);
  }

  @Put(':id/automatica')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Que corra sola al entrar un lead, o solo a mano' })
  automatizar(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: { automatica: boolean }) {
    return this.reglas.automatizar(req.organizationId, id, dto?.automatica === true);
  }

  /*
   * Archivar y no borrar.
   *
   * Una regla que calificó leads explica por qué están como están; borrarla dejaría el historial
   * diciendo «regla eliminada» justo cuando alguien pregunta qué pasó. El verbo es `DELETE`
   * porque es lo que la pantalla espera de un botón de quitar.
   */
  @Delete(':id')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Archivar una regla' })
  archivar(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.reglas.archivar(req.organizationId, id, true);
  }

  @Put(':id/restaurar')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Sacar del archivo' })
  restaurar(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.reglas.archivar(req.organizationId, id, false);
  }

  /**
   * La empresa sobre la que se trabaja.
   *
   * Una cuenta de portal trabaja siempre sobre la suya, venga lo que venga en la dirección; el
   * equipo interno elige. Es la misma regla que ya siguen los correos.
   */
  private empresa(req: AuthenticatedRequest, pedido?: string): string {
    if (req.user.role === 'client') return req.user.clientId ?? '';
    return pedido ?? '';
  }
}
