import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';
import { LeadFitStatus } from '../leads/lead-fit-status.enum';
import { LeadStatus } from '../leads/lead-status.enum';
import { Type } from 'class-transformer';
import { ReglasService, type DatosDeRegla } from './reglas.service';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { RequiresPermission } from '../../../core/authorization/requires-permission.decorator';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import { ClientCapabilityService } from '../../../core/client-scope/client-capability.service';
import type { AuthenticatedRequest } from '../../../shared/types/request';

/** Forma de un identificador de empresa, para rechazar lo que no puede serlo antes de consultar. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class CondicionDto {
  @IsIn(['respuestas', 'pregunta', 'campo', 'fuente', 'responsable', 'monto', 'campana']) donde: string;
  @IsOptional() @IsString() @MaxLength(200) clave?: string;
  @IsIn(['contiene', 'no_contiene', 'es', 'no_es', 'vacio', 'no_vacio', 'mayor_que', 'menor_que']) comparador: string;
  @IsOptional() @IsString() @MaxLength(300) valor?: string;
}

/**
 * Lo que una regla puede hacer.
 *
 * Cada acción se valida contra los mismos valores que el resto del CRM: sin eso, una regla podía
 * guardar una calificación inventada y escribirla en el lead, y el tablero mostraba un estado
 * que ninguna pantalla sabe pintar. El origen —una regla, no una persona— es lo último donde
 * alguien buscaría.
 *
 * No están «crear tarea» ni «avisar a alguien»: se aceptaban y no hacían nada. Guardar algo que
 * se ignora en silencio es peor que no ofrecerlo, porque quien lo configuró da por hecho que
 * ocurre. Vuelven cuando se implementen.
 */
class AccionesDto {
  @IsOptional() @IsIn(['green', 'yellow', 'red']) semaforo?: 'green' | 'yellow' | 'red';
  @IsOptional() @IsEnum(LeadFitStatus) calificacion?: LeadFitStatus;
  @IsOptional() @IsEnum(LeadStatus) etapa?: LeadStatus;
  @IsOptional() @IsUUID() responsable?: string;
  @IsOptional() @IsString() @MaxLength(200) descartarMotivo?: string;
  @IsOptional() @IsString() @MaxLength(500) nota?: string;
  @IsOptional() @Matches(/^[a-z][a-z0-9_]{0,39}$/) guardarEnCampo?: string;
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
 * sin dueño calificaría empresas que nadie revisó.
 *
 * Toda ruta pasa por `empresa()` o por `empresaDeLaRegla()` antes de tocar nada, así que el
 * alcance de la cuenta decide siempre sobre qué empresa se opera. El guard de permisos no lo
 * cubre: comprueba el nivel del módulo y el servicio contratado, y deja el alcance a la ruta
 * —`aplicar` escribe el semáforo, la etapa y el responsable de los leads que recibe—.
 */
@ApiTags('CRM · Reglas de calificación')
@Controller('crm/reglas')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('crm')
export class ReglasController {
  constructor(
    private readonly reglas: ReglasService,
    private readonly accountAccess: AccountAccessService,
    private readonly capacidades: ClientCapabilityService,
  ) {}

  @Get()
  @RequiresPermission('crm', 'view')
  @ApiOperation({ summary: 'Reglas de una empresa, en orden' })
  async listar(@Req() req: AuthenticatedRequest, @Query('clientId') clientId: string, @Query('archivadas') archivadas?: string) {
    return this.reglas.listar(req.organizationId, await this.empresa(req, clientId), archivadas === 'true');
  }

  @Get('preguntas')
  @RequiresPermission('crm', 'view')
  @ApiOperation({ summary: 'Preguntas que están llegando, con sus respuestas y cuántos las contestan' })
  async preguntas(@Req() req: AuthenticatedRequest, @Query('clientId') clientId: string) {
    return this.reglas.preguntasQueLlegan(req.organizationId, await this.empresa(req, clientId));
  }

  @Post('probar')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Cuántos leads calzarían con una regla, sin tocarlos' })
  async probar(@Req() req: AuthenticatedRequest, @Query('clientId') clientId: string, @Body() dto: GuardarReglaDto) {
    return this.reglas.cuantosCalzan(req.organizationId, await this.empresa(req, clientId), dto as DatosDeRegla);
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
  async aplicar(@Req() req: AuthenticatedRequest, @Query('clientId') clientId: string, @Body() dto: AplicarDto) {
    return this.reglas.aplicarYGuardar(req.organizationId, await this.empresa(req, clientId), dto.leadIds);
  }

  @Post()
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Crear una regla' })
  async crear(@Req() req: AuthenticatedRequest, @Query('clientId') clientId: string, @Body() dto: GuardarReglaDto) {
    return this.reglas.crear(req.organizationId, await this.empresa(req, clientId), dto as DatosDeRegla, req.user.id);
  }

  @Put('orden')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Reordenar: manda la primera que calza' })
  async reordenar(@Req() req: AuthenticatedRequest, @Query('clientId') clientId: string, @Body() dto: OrdenDto) {
    return this.reglas.reordenar(req.organizationId, await this.empresa(req, clientId), dto.ids);
  }

  /**
   * Copiar las reglas de otra empresa.
   *
   * Se comprueban **las dos** empresas, y el origen importa más que el destino: es de donde se
   * leen las reglas ajenas. Comprobar sólo el destino dejaría copiar a la empresa propia la
   * calificación de cualquier otra, que es leerla.
   */
  @Post('copiar')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Copiar las reglas de otra empresa, apagadas' })
  async copiar(@Req() req: AuthenticatedRequest, @Query('clientId') clientId: string, @Body() dto: CopiarDto) {
    const destino = await this.empresa(req, clientId);
    const origen = await this.empresa(req, dto.desdeClientId);
    const copiadas = await this.reglas.copiarDesde(req.organizationId, origen, destino, req.user.id);
    return { copiadas };
  }

  @Put(':id')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Editar una regla' })
  async editar(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: GuardarReglaDto) {
    await this.empresaDeLaRegla(req, id);
    return this.reglas.editar(req.organizationId, id, dto as DatosDeRegla);
  }

  @Put(':id/activa')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Encender o apagar' })
  async activar(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: { activa: boolean }) {
    await this.empresaDeLaRegla(req, id);
    return this.reglas.activar(req.organizationId, id, dto?.activa === true);
  }

  @Put(':id/automatica')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Que corra sola al entrar un lead, o solo a mano' })
  async automatizar(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: { automatica: boolean }) {
    await this.empresaDeLaRegla(req, id);
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
  async archivar(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.empresaDeLaRegla(req, id);
    return this.reglas.archivar(req.organizationId, id, true);
  }

  @Put(':id/restaurar')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Sacar del archivo' })
  async restaurar(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.empresaDeLaRegla(req, id);
    return this.reglas.archivar(req.organizationId, id, false);
  }

  /**
   * La empresa sobre la que se trabaja, comprobada contra el alcance de quien pregunta.
   *
   * Una cuenta de portal trabaja siempre sobre la suya, venga lo que venga en la dirección; el
   * equipo interno elige, pero sólo entre las que alcanza. Las tres comprobaciones son las
   * mismas que hace el resto del CRM, en el mismo orden:
   *
   * 1. `empresaDeTrabajo` encierra a la cuenta de portal en una empresa que alcance; al equipo
   *    interno le devuelve lo pedido tal cual, sin comprobarlo.
   * 2. `assertClient` es la reja: responde 404 si la empresa no existe en la organización o
   *    queda fuera del alcance de la cuenta. Es la que ataja a un cargo acotado por pod que
   *    escriba el identificador de otra empresa en la dirección.
   * 3. `capacidades.assert` exige que esa empresa tenga CRM contratado, para no configurar la
   *    calificación de una que sólo lleva reservas.
   *
   * El 400 de abajo no es cosmético: `assertClient` sobre vacío no comprueba nada y devuelve sin
   * error, de modo que sin empresa la consulta pasaría a tocar la organización entera.
   *
   * Garantiza que ninguna ruta de este controlador pueda leer ni escribir sobre una empresa
   * fuera del alcance de la cuenta, aunque su identificador llegue escrito a mano en la
   * dirección. El permiso del cargo y el servicio contratado los comprueba el guard; el alcance
   * por cuenta no lo comprueba nadie más, y aquí es donde se decide.
   */
  private async empresa(req: AuthenticatedRequest, pedido?: string): Promise<string> {
    const clientId = await this.accountAccess.empresaDeTrabajo(req.organizationId, req.user, pedido);
    if (!clientId) throw new BadRequestException('Falta la empresa sobre la que trabajar');
    /*
     * La forma se comprueba sobre la empresa ya resuelta y no sobre lo pedido: una cuenta de
     * portal se repliega a la suya ante un valor que no alcanza, y validar antes convertiría ese
     * repliegue en un error.
     */
    if (!UUID.test(clientId)) throw new BadRequestException('La empresa no tiene una forma válida');
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    await this.capacidades.assert(req.organizationId, clientId, 'crm');
    return clientId;
  }

  /**
   * La empresa de una regla que se identifica por `:id`, comprobada igual que las demás.
   *
   * Editar, encender, automatizar, archivar y restaurar no reciben empresa: sólo el
   * identificador de la regla. La empresa se lee de la propia regla y se comprueba, de modo que
   * esas rutas quedan tan acotadas como las que la traen en la dirección.
   */
  private async empresaDeLaRegla(req: AuthenticatedRequest, id: string): Promise<string> {
    const clientId = await this.reglas.empresaDeLaRegla(req.organizationId, id);
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    await this.capacidades.assert(req.organizationId, clientId, 'crm');
    return clientId;
  }
}
