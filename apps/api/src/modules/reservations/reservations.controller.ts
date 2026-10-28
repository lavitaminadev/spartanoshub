import { PermissionResolverService } from '../../core/authorization/permission-resolver.service';
import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, ParseArrayPipe, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { CompanyLegalDto, CompanyLegalScopeDto, empresaDeLosDatosLegales, asegurarQueAdministraLaEmpresa, guardarDatosLegales, leerDatosLegales } from '../clients/datos-legales-de-empresa';
import { DataSource } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '@shared/types/request';
import type { Response } from 'express';
import { once } from 'node:events';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { ClientCapabilityService } from '../../core/client-scope/client-capability.service';
import { AuditService } from '../../core/audit/audit.service';
import { NivelDeDatosService, recortarFilasPorEmpresa } from '../../core/client-scope/nivel-de-datos.service';
import { CATALOGO_DE_RUBROS } from '@espartanos/shared';
import { SinEmpresa } from '../../core/client-scope/empresa.decorator';
import { Roles } from '../../core/authorization/roles.decorator';
import { RequiresPermission } from '../../core/authorization/requires-permission.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { ReservationsService } from './application/reservations.service';
import { ReservationsBulkImportService } from './application/bulk-import.service';
import { columnasDelCsv } from './application/exportaciones';
import { ActualizarOperacionDto, CanjeDeCuponDto, CloseReservationDayDto, ConvertGroupRequestDto, CreateBlockDto, CreateCouponDto, CreateManualReservationDto, CreateReservationFormDto, ExportCsvQueryDto, ExportFormReservationsDto, HojaDelTurnoDto, ImportReservationsDto, ListCanjesDto, ListCouponsDto, ListReservationsDto, OccupancyQueryDto, ReservationScopeDto, UpdateContactRequestDto, UpdateCouponDto, UpdateGroupRequestDto, PauseReservationFormDto, RegistrarSalidaDto, UpdateReservationDto, UpdateReservationFormDto } from './dto/reservation.dto';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';
import { RequiereAccion } from '../../core/authorization/requiere-accion';
import { RequiereArea } from '../../core/authorization/requiere-area.decorator';

@ApiTags('Reservas')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('reservations')
@ModuleScope('reservations')
export class ReservationsController {
  constructor(
    private readonly service: ReservationsService,
    private readonly accountAccess: AccountAccessService,
    private readonly capabilities: ClientCapabilityService,
    private readonly bulkImport: ReservationsBulkImportService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
    private readonly permisos: PermissionResolverService,
    private readonly niveles: NivelDeDatosService,
  ) {}

  private publicOrigin(): string | undefined {
    return (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '') || undefined;
  }

  private async decorateForm(organizationId: string, clientId: string, form: any) {
    const context = await this.service.formContext(organizationId, clientId, form);
    const publicOrigin = this.publicOrigin();
    return { ...form, ...context, publicUrl: publicOrigin ? `${publicOrigin}/book/${form.publicSlug}` : undefined };
  }

  /**
   * La empresa sobre la que trabaja una cuenta de portal: la que declare y alcance, o la suya.
   *
   * Declararla no concede nada —`scope` comprueba a continuación que tenga Reservas contratado—,
   * y una que no se alcanza da 404. Lo que arregla es el caso de quien atiende dos locales: la
   * empresa salía siempre de la sesión, así que mirar el segundo mostraba y escribía en el
   * primero. Devuelve `undefined` para el equipo interno, que se acota por `clientIds`; las rutas
   * que además admiten elegir una empresa concreta usan `requestedScope`.
   */
  private async empresaDelPortalEnLaPeticion(req: AuthenticatedRequest): Promise<string | undefined> {
    if (req.user.role !== UserRole.CLIENT) return undefined;
    const declarada = (req.query as { clientId?: string } | undefined)?.clientId?.trim();
    if (declarada && declarada !== req.user.clientId) {
      await this.accountAccess.assertClient(req.organizationId, req.user, declarada);
      return declarada;
    }
    if (!req.user.clientId) throw new ForbiddenException('La cuenta cliente no está asociada a una empresa');
    return req.user.clientId;
  }

  private async scope(req: AuthenticatedRequest) {
    const clientId = await this.empresaDelPortalEnLaPeticion(req);
    // Ningún parámetro de la URL convierte una cuenta sin Reservas en una con acceso: la empresa
    // ya pasó por el alcance, y aquí se comprueba que tenga el servicio contratado.
    if (clientId) await this.capabilities.assert(req.organizationId, clientId, 'reservations');
    return {
      clientId,
      clientIds: await this.accountAccess.allowedClientIds(req.organizationId, req.user),
    };
  }

  /** Una reserva recortada según lo que esta persona ve de la empresa a la que pertenece. */
  private async recortada<T extends { clientId?: string | null }>(req: AuthenticatedRequest, reserva: T) {
    const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'reservations');
    return recortarFilasPorEmpresa([reserva], 'reservations', niveles)[0];
  }

  private async requestedScope(req: AuthenticatedRequest, requestedClientId?: string) {
    const scope = await this.scope(req);
    if (!requestedClientId) return scope;
    await this.accountAccess.assertClient(req.organizationId, req.user, requestedClientId);
    return { clientId: requestedClientId, clientIds: undefined };
  }

  /**
   * Datos legales de la empresa (compartidos con Encuestas, que tiene su propia ruta).
   *
   * El portal lee y guarda los de su empresa; el equipo indica la empresa y se valida que la tenga
   * a cargo.
   */
  @Get('company-legal')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async companyLegal(@Req() req: AuthenticatedRequest, @Query() query: CompanyLegalScopeDto) {
    return leerDatosLegales(this.dataSource, req.organizationId, await this.empresaLegal(req, query.clientId));
  }

  @Put('company-legal')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async saveCompanyLegal(@Req() req: AuthenticatedRequest, @Query() query: CompanyLegalScopeDto, @Body() dto: CompanyLegalDto) {
    const empresa = await this.empresaLegal(req, query.clientId);
    await asegurarQueAdministraLaEmpresa(this.permisos, req.organizationId, req.user, empresa);
    // El contrato de encargo lo acepta la empresa, no la agencia en su nombre: sólo una cuenta de
    // portal puede marcarlo. Estaba escrito como «si la cuenta tiene empresa», que daba lo mismo
    // mientras la empresa de la sesión fuera la única posible, y ahora ya no lo es.
    const laAceptaLaEmpresa = req.user.role === UserRole.CLIENT;
    return guardarDatosLegales(this.dataSource, this.audit, req.organizationId, empresa, { ...dto, aceptaEncargo: laAceptaLaEmpresa ? dto.aceptaEncargo : undefined }, req.user.id, req.user.name);
  }

  /**
   * La empresa cuyos datos legales se tocan, y que tiene Reservas contratado.
   *
   * La resolución es la misma que en Encuestas y vive en `empresaDeLosDatosLegales`; aquí sólo se
   * añade la reja propia del módulo. Una cuenta de portal que declara una empresa que alcanza
   * trabaja sobre ella, que es lo que permite a quien atiende dos locales mantener los datos del
   * segundo en vez de escribirlos en el primero.
   */
  private async empresaLegal(req: AuthenticatedRequest, pedida?: string): Promise<string> {
    const empresa = await empresaDeLosDatosLegales(this.accountAccess, req.organizationId, req.user, pedida);
    await this.capabilities.assert(req.organizationId, empresa, 'reservations');
    return empresa;
  }

  /** Envíos a Meta de una sucursal en los últimos 30 días: enviados, pendientes, fallidos y último error. */
  @Get('forms/:id/meta-health')
  @RequiereArea('reservations.medicion', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  async metaHealth(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    return this.service.saludDeMedicion(req.organizationId, id, scope.clientId, scope.clientIds);
  }

  /** Pixels que este local puede elegir. Antes del `:id`, o la ruta la tomaría el detalle. */
  @Get('forms/meta-pixels')
  @RequiereArea('reservations.medicion', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  async pixelesDisponibles(@Req() req: AuthenticatedRequest, @Query() query: ReservationScopeDto) {
    const scope = await this.requestedScope(req, query.clientId);
    const clientId = scope.clientId ?? query.clientId;
    if (!clientId) throw new ForbiddenException('Indica la empresa del local');
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    return this.service.pixelesDelFormulario(req.organizationId, clientId);
  }

  /**
   * Los rubros y sus tipos de captación, para el selector al crear un formulario.
   *
   * Sale del catálogo en código, igual para toda la organización, y no toca la base: no lleva
   * empresa ni alcance porque no dice nada de nadie, sólo con qué valores puede nacer un
   * formulario. Quien crea formularios es quien lo necesita, así que lleva los mismos cargos.
   */
  @Get('catalogo-de-rubros')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  @SinEmpresa('el catálogo es el mismo para toda la organización y no describe a ninguna empresa')
  catalogoDeRubros() {
    return { data: CATALOGO_DE_RUBROS };
  }

  @Get('forms')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async forms(@Req() req: AuthenticatedRequest, @Query() query: ReservationScopeDto) {
    const scope = await this.requestedScope(req, query.clientId);
    const forms = await this.service.listForms(req.organizationId, scope.clientId, scope.clientIds);
    const publicOrigin = this.publicOrigin();
    return forms.map((form) => ({ ...form, publicUrl: publicOrigin ? `${publicOrigin}/book/${form.publicSlug}` : undefined }));
  }

  @Post('forms')
  @RequiereArea('reservations.configurar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateReservationFormDto) {
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    const form = await this.service.createForm(req.organizationId, req.user.id, dto);
    return this.decorateForm(req.organizationId, form.clientId, form);
  }

  @Get('forms/:id')
  @RequiereArea('reservations.configurar', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async form(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    const form = await this.service.getForm(req.organizationId, id, scope.clientId, scope.clientIds);
    return this.decorateForm(req.organizationId, form.clientId, form);
  }

  @Patch('forms/:id/pause')
  @RequiereArea('reservations.publicar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async pause(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: PauseReservationFormDto) {
    const scope = await this.scope(req);
    const form = await this.service.pauseForm(req.organizationId, id, dto.until ?? '', scope.clientId, scope.clientIds, req.user.id);
    return this.decorateForm(req.organizationId, form.clientId, form);
  }

  @Patch('forms/:id')
  @RequiereAccion('reservations.configurar')
  @RequiereArea('reservations.configurar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateReservationFormDto) {
    const scope = await this.scope(req);
    if (req.user.role === UserRole.CLIENT) {
      const allowed: UpdateReservationFormDto = {
        timezone: dto.timezone,
        durationMinutes: dto.durationMinutes,
        bufferMinutes: dto.bufferMinutes,
        capacityPerSlot: dto.capacityPerSlot,
        dailyCapacity: dto.dailyCapacity,
        minimumNoticeHours: dto.minimumNoticeHours,
        maximumAdvanceDays: dto.maximumAdvanceDays,
        confirmationMode: dto.confirmationMode,
        // El cliente puede editar los campos y servicios de SU local. Antes el constructor
        // los mostraba editables pero el controlador los descartaba sin avisar al guardar.
        fieldSchema: dto.fieldSchema,
        scheduleConfig: dto.scheduleConfig,
        servicesConfig: dto.servicesConfig,
        resourcesConfig: dto.resourcesConfig,
        designConfig: dto.designConfig,
        name: dto.name,
        // Publicar o pausar es una decisión operativa del dueño de su propio local. El alcance
        // ya queda fijado por la sesión; no habilita editar otro cliente ni configurar Meta.
        status: dto.status,
        teamNotifications: dto.teamNotifications,
        // El portal muestra este ajuste; omitirlo aquí lo convertía en un interruptor que parecía
        // guardar pero el servidor descartaba silenciosamente para el rol cliente.
        calendarEnabled: dto.calendarEnabled,
      };
      const form = await this.service.updateForm(req.organizationId, id, allowed, scope.clientId, scope.clientIds);
      return this.decorateForm(req.organizationId, form.clientId, form);
    }
    const form = await this.service.updateForm(req.organizationId, id, dto, scope.clientId, scope.clientIds);
    return this.decorateForm(req.organizationId, form.clientId, form);
  }

  /**
   * Los ajustes del día a día, sin pasar por el constructor.
   *
   * No lleva la acción `reservations.configurar`: es la puerta que queda abierta para quien opera
   * el local sin tocar campos, textos legales, medición ni publicación. Sí exige el área
   * `reservations.configurar`, porque cupo, tolerancia y zonas son configuración del local. La lista de
   * lo que acepta la fija el DTO, y lo que no esté en ella se descarta aquí, no en la pantalla.
   */
  @Patch('forms/:id/operacion')
  @RequiresPermission('reservations', 'edit')
  @RequiereArea('reservations.configurar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async actualizarOperacion(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ActualizarOperacionDto) {
    const scope = await this.scope(req);
    const form = await this.service.actualizarOperacion(req.organizationId, id, dto, scope.clientId, scope.clientIds);
    return this.decorateForm(req.organizationId, form.clientId, form);
  }

  @Post('forms/:id/duplicate')
  @RequiereArea('reservations.configurar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  async duplicate(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    const form = await this.service.duplicateForm(req.organizationId, id, req.user.id, scope.clientIds);
    return this.decorateForm(req.organizationId, form.clientId, form);
  }

  /** Quién cambió qué en esta reserva, para el hub: la auditoría completa sigue en Gobernanza. */
  @Get('forms/:id/ultimos-cambios')
  @RequiereArea('reservations.configurar', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async ultimosCambios(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    return this.service.ultimosCambios(req.organizationId, id, scope.clientId, scope.clientIds);
  }

  @Get('forms/:id/blocks')
  @RequiereArea('reservations.configurar', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async blocks(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    return this.service.listBlocks(req.organizationId, id, scope.clientId, scope.clientIds);
  }

  @Post('forms/:id/blocks')
  @RequiereArea('reservations.configurar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async block(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: CreateBlockDto) {
    const scope = await this.scope(req);
    return this.service.addBlock(req.organizationId, id, req.user.id, dto, scope.clientId, scope.clientIds);
  }

  @Post('forms/:id/blocks/batch')
  @RequiereArea('reservations.configurar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async batchBlock(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body(new ParseArrayPipe({ items: CreateBlockDto, whitelist: true, forbidNonWhitelisted: true })) dtos: CreateBlockDto[]) {
    if (dtos.length > 365) throw new BadRequestException('No puedes crear mas de 365 bloqueos por lote');
    const scope = await this.scope(req);
    const errors: string[] = [];
    const results = await Promise.all(dtos.map((dto) => this.service.addBlock(req.organizationId, id, req.user.id, dto, scope.clientId, scope.clientIds).catch((err: Error) => { errors.push(err.message); return null; })));
    if (errors.length && results.filter(Boolean).length === 0) throw new BadRequestException(errors.join('; '));
    return { created: results.filter(Boolean).length, total: dtos.length, errors: errors.length ? errors : undefined };
  }

  @Delete('blocks/:id')
  // Quitar un bloqueo es parte de configurar la disponibilidad, no una operación de
  // administración: el cliente abre y cierra franjas a diario. Se declara `edit` en vez de
  // heredar el `manage` que el verbo asigna por omisión.
  @RequiresPermission('reservations', 'edit')
  @RequiereArea('reservations.configurar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async deleteBlock(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    return this.service.removeBlock(req.organizationId, id, scope.clientId, scope.clientIds, req.user.id);
  }

  /**
   * Reserva anotada por el equipo: una llamada, alguien que pasa por el local.
   *
   * La cuenta del propio local también puede hacerlo: es quien contesta el teléfono, y sin esto
   * no tenía cómo registrar una reserva que no entró por la página. Queda dentro de su empresa
   * por el alcance de la sesión, y no puede saltarse el control de cupo: sobrevender una mesa es
   * una decisión que se reserva al equipo de operaciones.
   */
  @Post('manual')
  @RequiereArea('reservations.tomar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async createManual(@Req() req: AuthenticatedRequest, @Body() dto: CreateManualReservationDto) {
    const scope = await this.scope(req);
    if (req.user.role === UserRole.CLIENT) dto.skipAvailability = false;
    return this.recortada(req, await this.service.createManual(req.organizationId, req.user.id, dto, scope.clientId, scope.clientIds));
  }

  @Post('import')
  @RequiereAccion('reservations.importar')
  @RequiereArea('reservations.configurar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async importReservations(@Req() req: AuthenticatedRequest, @Body() dto: ImportReservationsDto) {
    const scope = await this.scope(req);
    // La vista previa no escribe nada: valida el archivo y devuelve fila a fila
    // qué se importaría y qué errores hay, para revisar antes de confirmar.
    if (dto.dryRun) {
      // Se resuelve el formulario tambien en la vista previa: las fechas del archivo describen
      // la hora del local, y de paso queda comprobado que el formulario es de quien lo pide.
      const form = await this.service.getForm(req.organizationId, dto.formId, scope.clientId, scope.clientIds);
      return this.bulkImport.parse(dto.csvContent, dto.formId, form.timezone);
    }
    return this.bulkImport.import(req.organizationId, req.user.id, dto.csvContent, dto.formId, {
      skipAvailability: dto.skipAvailability,
      clientId: scope.clientId,
      clientIds: scope.clientIds,
    });
  }

  @Get()
  @RequiereArea('reservations.reservas', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async list(@Req() req: AuthenticatedRequest, @Query() query: ListReservationsDto) {
    const scope = await this.requestedScope(req, query.clientId);
    const respuesta = await this.service.listReservations(req.organizationId, query, scope.clientId, scope.clientIds, req.user.role !== UserRole.CLIENT);
    const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'reservations');
    return { ...respuesta, data: recortarFilasPorEmpresa(respuesta.data, 'reservations', niveles) };
  }

  @Patch(':id')
  @RequiereArea('reservations.reservas', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async updateReservation(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateReservationDto) {
    const scope = await this.scope(req);
    // La empresa opera su propio local: confirma, marca asistencia, reprograma, cancela y anota.
    // La etapa de producción es de la agencia y queda fuera del portal.
    if (req.user.role === UserRole.CLIENT && dto.workflowState !== undefined) {
      throw new ForbiddenException('La etapa de producción la gestiona el equipo de Espartanos');
    }
    return this.recortada(req, await this.service.updateReservation(
      req.organizationId,
      id,
      dto,
      req.user.id,
      req.user.role === UserRole.CLIENT ? 'client' : 'team',
      scope.clientId,
      scope.clientIds,
    ));
  }

  @Get('group-requests')
  @RequiereArea('reservations.espera_y_grupos', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async allGroupRequests(@Req() req: AuthenticatedRequest, @Query('formId') formId?: string, @Query('clientId') clientId?: string) {
    // La empresa elegida en el filtro acota de verdad; antes se ignoraba y la lista no cambiaba.
    const scope = await this.requestedScope(req, clientId);
    return this.service.listAllGroupRequests(req.organizationId, scope.clientId, scope.clientIds, formId);
  }

  @Get('forms/:id/group-requests')
  @RequiereArea('reservations.espera_y_grupos', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async groupRequests(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    return this.service.listGroupRequests(req.organizationId, id, scope.clientId, scope.clientIds);
  }

  /** Convierte una solicitud de grupo en reserva real, con la fecha que se acordó. */
  @Post('group-requests/:id/convert')
  @RequiereArea('reservations.espera_y_grupos', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async convertGroupRequest(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ConvertGroupRequestDto) {
    const scope = await this.scope(req);
    return this.service.convertGroupRequest(req.organizationId, id, dto, req.user.id, scope.clientId, scope.clientIds);
  }

  @Patch('group-requests/:id')
  @RequiereArea('reservations.espera_y_grupos', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async updateGroupRequest(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateGroupRequestDto) {
    const scope = await this.scope(req);
    return this.service.updateGroupRequest(req.organizationId, id, dto, req.user.id, scope.clientId, scope.clientIds);
  }

  @Post('close-day')
  @RequiereArea('reservations.configurar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  async closeDay(@Req() req: AuthenticatedRequest, @Body() dto: CloseReservationDayDto) {
    const scope = await this.scope(req);
    return this.service.closeDayByException(req.organizationId, dto, req.user.id, scope.clientId, scope.clientIds);
  }

  /** Si esta persona ya reservó antes en la misma empresa. Solo lectura. */
  @Get(':id/guest-history')
  @RequiereArea('reservations.reservas', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async guestHistory(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    const historial = await this.service.guestHistory(req.organizationId, id, scope.clientId, scope.clientIds);
    const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'reservations');
    // Las preferencias salen de las respuestas del formulario, donde viven las alergias: siguen
    // la misma regla que ellas y no viajan a quien no las ve.
    if (niveles.de(historial.clientId) === 'directo') return historial;
    const { preferencias: _preferencias, ...sinPreferencias } = historial;
    return sinPreferencias;
  }

  /**
   * Los datos protegidos de una reserva, para quien los pidió desde su ficha.
   *
   * Con `bajo_registro` deja constancia de quién los vio y cuándo antes de responder: si la
   * constancia no se puede escribir, la respuesta falla y el dato no sale. Con `oculto` no hay
   * forma de pedirlos. Con `directo` ya los recibía en la ficha y no hay nada que anotar.
   */
  @Get(':id/datos-protegidos')
  @RequiereArea('reservations.reservas', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async datosProtegidos(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    const scope = await this.scope(req);
    const reserva = await this.service.datosProtegidosDeReserva(req.organizationId, id, scope.clientId, scope.clientIds);
    const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'reservations');
    const nivel = niveles.de(reserva.clientId);
    if (nivel === 'oculto') throw new ForbiddenException('Tu perfil no permite ver estos datos');
    if (nivel === 'bajo_registro') {
      await this.audit.log({
        organizationId: req.organizationId, actorId: req.user.id, entityType: 'reservations', entityId: id,
        action: 'reveal_protected_data', reason: `campos=${Object.keys(reserva.datos).join(',')}`,
        ipAddress: req.ip,
      });
    }
    return { id, datos: reserva.datos };
  }

  /** Quien ya llegó se fue, o sigue en la mesa: mueve el fin de la reserva y con él su cupo. */
  @Post(':id/salida')
  @RequiereArea('reservations.turno', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async registrarSalida(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: RegistrarSalidaDto) {
    const scope = await this.scope(req);
    return this.service.registrarSalida(req.organizationId, id, dto.accion, req.user.id, req.user.role === UserRole.CLIENT ? 'client' : 'team', scope.clientId, scope.clientIds);
  }

  @Get(':id/history')
  @RequiereArea('reservations.reservas', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async history(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    return this.service.history(req.organizationId, id, scope.clientId, scope.clientIds);
  }

  /**
   * Cuántas veces este comensal se presentó y cuántas no, dentro de la misma empresa.
   *
   * El teléfono y el correo sirven para agrupar, pero lo que sale pasa por el recorte de la
   * persona que mira: con `oculto` o `bajo_registro` la respuesta trae el recuento y no el dato
   * de contacto. Quien lo necesita lo pide desde la ficha, que deja la constancia.
   */
  @Get(':id/historial-del-comensal')
  @RequiereArea('reservations.historial', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async historialDelComensal(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    const scope = await this.scope(req);
    const historial = await this.service.historialDelComensal(req.organizationId, id, scope.clientId, scope.clientIds);
    const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'reservations');
    const [comensal] = recortarFilasPorEmpresa([historial.comensal], 'reservations', niveles);
    return { ...historial, comensal };
  }

  /**
   * Qué le pasó a una reserva, en orden.
   *
   * Los eventos se guardaban con su actor desde hace tiempo y no los leía nadie: «quién canceló
   * esto y cuándo» sólo se podía contestar entrando a la base.
   */
  @Get(':id/historial')
  @RequiresPermission('reservations', 'view')
  @RequiereArea('reservations.reservas', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async historialDeReserva(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    return this.service.historialDeReserva(req.organizationId, id, scope.clientIds);
  }

  @Get('coupons')
  @RequiereArea('reservations.cupones', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async listCoupons(@Req() req: AuthenticatedRequest, @Query() query: ListCouponsDto) {
    /*
     * La empresa elegida arriba filtra la lista.
     *
     * La pantalla ya mandaba `clientId` y esta ruta lo ignoraba: el selector cambiaba todas las
     * demás pestañas y en Cupones seguían viéndose los de todas las empresas. Nadie lo notaba
     * mientras hubiera una sola.
     *
     * `requestedScope` comprueba que la cuenta alcance esa empresa antes de aceptarla, así que
     * pedir una ajena por la dirección no devuelve nada que no corresponda.
     */
    const scope = await this.requestedScope(req, query.clientId);
    /*
     * La lista viene con lo que pasó con cada cupón, no sólo con su configuración.
     *
     * Se resuelven juntas y no en dos llamadas porque la pantalla las muestra en la misma fila: un
     * cupón sin «cuántos volvieron» al lado es una regla, no una medición, y era lo único que se
     * podía ver hasta ahora.
     */
    const [cupones, uso] = await Promise.all([
      this.service.listCoupons(req.organizationId, scope.clientId, scope.clientIds, { estado: query.estado, codigo: query.codigo }),
      this.service.usoDeCupones(req.organizationId, scope.clientId, scope.clientIds, { desde: query.desde, hasta: query.hasta }),
    ]);
    const porCodigo = new Map(uso.map((fila) => [fila.code, fila]));
    return cupones.map((cupon) => ({
      ...cupon,
      uso: porCodigo.get(cupon.code) ?? { code: cupon.code, enviados: 0, usados: 0, volvieronDelCorreo: 0 },
    }));
  }

  /**
   * Crear un cupón pide `manage`, no `edit`.
   *
   * No es la misma decisión que anotar uno usado. Crear define una oferta pública y compromete
   * descuentos a futuro: quien lo hace fija cuánto se regala, a cuántas personas y hasta cuándo.
   * Anotar un canje registra algo que ya ocurrió, con la persona delante, y es lo que hay que
   * poder hacer en la caja sin ir a buscar a nadie.
   *
   * De fábrica una cuenta de empresa tiene `reservations: edit`, así que con esto un usuario
   * normal canjea y no crea, y quien administra la empresa hace las dos cosas.
   */
  @Post('coupons')
  @RequiresPermission('reservations', 'manage')
  @RequiereArea('reservations.cupones', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async createCoupon(@Req() req: AuthenticatedRequest, @Body() dto: CreateCouponDto) {
    // Una cuenta de empresa crea cupones sólo para sí misma, diga lo que diga el cuerpo.
    if (req.user.role === UserRole.CLIENT) dto.clientId = (await this.empresaDelPortalEnLaPeticion(req))!;
    // Todo cupón tiene empresa. Uno sin dueño se aceptaba en los locales de todos los clientes, y
    // un descuento pensado para un negocio terminaba aplicándose en otro.
    if (!dto.clientId) throw new BadRequestException('Elige la empresa del cupón: cada cupón vale sólo en los locales de su empresa.');
    // El cupón modifica la oferta pública de una empresa: no basta con el permiso del
    // módulo; quien lo crea debe alcanzar esa empresa y tener Reservas contratado.
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    await this.capabilities.assert(req.organizationId, dto.clientId, 'reservations');
    return this.service.createCoupon(req.organizationId, req.user.id, dto, dto.clientId);
  }

  /** Cambiar un cupón es cambiar la oferta: el mismo `manage` que crearlo. */
  @Patch('coupons/:id')
  @RequiresPermission('reservations', 'manage')
  @RequiereArea('reservations.cupones', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async updateCoupon(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateCouponDto) {
    const scope = await this.scope(req);
    return this.service.updateCoupon(req.organizationId, id, dto, scope.clientIds);
  }

  /**
   * Anota un cupón canjeado en el local, de alguien que no reservó.
   *
   * Pide el mismo permiso de edición que cambiar el cupón: anotar un canje consume un uso y
   * entrega un descuento, así que no es una lectura.
   */
  /**
   * Busca un cupón por el código que trae la persona.
   *
   * Lectura, pero pide `edit` igual que canjear: la respuesta dice cuántos usos quedan y hasta
   * cuándo vale, y eso es información de la oferta de una empresa, no de un cupón suelto.
   */
  @Get('coupons/buscar')
  @RequiresPermission('reservations', 'edit')
  @RequiereArea('reservations.canjear_cupon', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async buscarCupon(@Req() req: AuthenticatedRequest, @Query('codigo') codigo: string) {
    if (!codigo?.trim()) throw new BadRequestException('Escribe el código del cupón');
    const scope = await this.scope(req);
    return this.service.buscarCuponPorCodigo(req.organizationId, codigo, scope.clientIds);
  }

  /** Qué pasó con un cupón: cuándo se usó, por qué camino y cuánto costó. */
  @Get('coupons/:id/metricas')
  @RequiresPermission('reservations', 'view')
  @RequiereArea('reservations.cupones', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async metricasDeCupon(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const scope = await this.scope(req);
    return this.service.metricasDeCupon(req.organizationId, id, scope.clientIds);
  }

  /**
   * Los canjes de un cupón, uno por uno.
   *
   * Las métricas resumen y devuelven los veinte últimos; esto responde «qué pasó el sábado» y
   * «cuáles se anotaron en la caja». Se guardaban desde la 0174 y hasta ahora sólo existía la
   * forma de crear uno.
   */
  @Get('coupons/:id/canjes')
  @RequiresPermission('reservations', 'view')
  @RequiereArea('reservations.cupones', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async canjesDeCupon(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Query() query: ListCanjesDto) {
    const scope = await this.scope(req);
    return this.service.canjesDeCupon(req.organizationId, id, scope.clientIds, query);
  }

  /** Los mismos canjes, para abrir en una planilla y cuadrar con la caja. */
  @Get('coupons/:id/canjes.csv')
  @RequiereAccion('reservations.exportar')
  @RequiereArea('reservations.exportar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async canjesCsv(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Query() query: ListCanjesDto, @Res() res: Response) {
    const scope = await this.scope(req);
    const csv = await this.service.csvDeCanjes(req.organizationId, id, scope.clientIds, query);
    // Igual que la exportación de reservas: un GET no pasa por el interceptor de auditoría y
    // esto saca datos de personas del sistema, así que se deja rastro a mano.
    void this.audit.log({
      organizationId: req.organizationId, actorId: req.user.id, entityType: 'reservation_coupons',
      action: 'export_canjes_csv', reason: `coupon=${id} desde=${query.desde ?? ''} hasta=${query.hasta ?? ''}`,
      ipAddress: req.ip,
    }).catch(() => {});
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="canjes-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Post('coupons/:id/canjes')
  @RequiresPermission('reservations', 'edit')
  @RequiereArea('reservations.canjear_cupon', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async canjearCuponEnLocal(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: CanjeDeCuponDto) {
    const scope = await this.scope(req);
    return this.service.canjearCuponEnLocal(req.organizationId, id, req.user.id, dto, scope.clientIds);
  }

  /**
   * CSV para que otra herramienta lo procese. Para que lo lea una persona está la planilla.
   *
   * Va etiquetado en el nombre y en la cabecera `X-Uso`: una línea de marca dentro del archivo
   * rompería a los lectores. Se anota antes de entregarlo y exige motivo si lleva datos protegidos
   * o es voluminoso.
   */
  @Get('export/csv')
  @RequiereAccion('reservations.exportar')
  @RequiereArea('reservations.exportar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async exportCsv(@Req() req: AuthenticatedRequest, @Query() query: ExportCsvQueryDto, @Res() res: Response) {
    const scope = await this.requestedScope(req, query.clientId);
    const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'reservations');
    const { columnas, conProtegidos } = columnasDelCsv(niveles, scope.clientId, scope.clientIds);
    const filas = await this.service.contarParaExportar(req.organizationId, scope.clientId, scope.clientIds, query.from, query.to, query.limit);
    await this.service.registrarExportacion({
      organizationId: req.organizationId, actor: { id: req.user.id, nombre: req.user.name }, ip: req.ip,
      finalidad: 'procesable', formato: 'csv',
      filtro: { clientId: scope.clientId ?? null, desde: query.from ?? null, hasta: query.to ?? null, limite: query.limit ?? null },
      filas, columnas, conProtegidos, desde: query.from, hasta: query.to, motivo: query.motivo,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reservas-para-procesar-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.setHeader('X-Uso', 'interno; contiene datos personales');
    // Se escribe por lotes en vez de armar el archivo completo y enviarlo de una sola vez: lo
    // que ocupa en memoria deja de depender de cu\u00E1ntas reservas se exporten. El `drain` evita
    // que los trozos se acumulen si el cliente descarga m\u00E1s lento de lo que se generan.
    res.write('\uFEFF');
    for await (const chunk of this.service.streamCsv(req.organizationId, niveles, scope.clientId, scope.clientIds, query.from, query.to, query.limit)) {
      if (!res.write(chunk)) await once(res, 'drain');
    }
    res.end();
  }

  /** Planilla `.xlsx` (por defecto) o CSV de proceso de un local. Se arma y se anota en el servidor. */
  @Post('forms/:formId/export')
  @RequiereAccion('reservations.exportar')
  @RequiereArea('reservations.exportar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async exportForm(
    @Req() req: AuthenticatedRequest,
    @Param('formId') formId: string,
    @Body() body: ExportFormReservationsDto,
    @Res() res: Response
  ) {
    const scope = await this.scope(req);
    const { cuerpo } = await this.service.exportFormReservations({
      organizationId: req.organizationId,
      niveles: await this.niveles.nivelesDe(req.organizationId, req.user.id, 'reservations'),
      formId,
      clientId: scope.clientId,
      clientIds: scope.clientIds,
      formato: body.format,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      fields: body.fields,
      includeInternalNotes: req.user.role !== UserRole.CLIENT,
      actor: { id: req.user.id, nombre: req.user.name },
      motivo: body.motivo,
      ip: req.ip,
    });

    const dia = new Date().toISOString().slice(0, 10);
    res.setHeader('X-Uso', 'interno; contiene datos personales');
    if (body.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="reservas-para-procesar-${dia}.csv"`);
      // La marca de orden de bytes la pone quien arma el texto: aqu\u00ED se env\u00EDa tal cual.
      res.send(cuerpo);
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="reservas-${dia}.xlsx"`);
      res.end(cuerpo as Buffer);
    }
  }

  /** Hoja del turno: un día en PDF para imprimir, sin campos protegidos. */
  @Get('forms/:formId/hoja-del-turno')
  @RequiereAccion('reservations.exportar')
  @RequiereArea('reservations.exportar', 'hacer')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async hojaDelTurno(
    @Req() req: AuthenticatedRequest,
    @Param('formId') formId: string,
    @Query() query: HojaDelTurnoDto,
    @Res() res: Response,
  ) {
    const scope = await this.scope(req);
    const hoja = await this.service.hojaDelTurno({
      organizationId: req.organizationId, formId, fecha: query.fecha,
      clientId: scope.clientId, clientIds: scope.clientIds,
      actor: { id: req.user.id, nombre: req.user.name }, ip: req.ip,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${hoja.nombre}"`);
    res.end(hoja.cuerpo);
  }

  /** Resumen del día para la portada operativa: cómo viene la jornada y si la señal llega. */
  @Get('analytics/operational-home')
  @RequiereArea('reservations.medicion', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async operationalHome(@Req() req: AuthenticatedRequest, @Query() query: ReservationScopeDto) {
    const scope = await this.requestedScope(req, query.clientId);
    return this.service.operationalHome(req.organizationId, scope.clientId, scope.clientIds);
  }

  @Get('analytics/metrics')
  @RequiereArea('reservations.medicion', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async metrics(@Req() req: AuthenticatedRequest, @Query() query: ReservationScopeDto) {
    const scope = await this.requestedScope(req, query.clientId);
    return this.service.metrics(req.organizationId, scope.clientId, scope.clientIds, query.days ? String(query.days) : '30');
  }

  /** Qué porcentaje de las reservas no se presenta, por local y por día de la semana. */
  @Get('analytics/no-show')
  @RequiereArea('reservations.historial', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async noShow(@Req() req: AuthenticatedRequest, @Query() query: ReservationScopeDto) {
    const scope = await this.requestedScope(req, query.clientId);
    return this.service.noShowPorLocalYDia(req.organizationId, scope.clientId, scope.clientIds, query.days ? Number(query.days) : 90);
  }

  /**
   * Del anuncio al comensal que llegó.
   *
   * Exige `reservations.medicion` y no `historial`: responde una pregunta de medición, no de
   * operación, y quien atiende el turno no necesita saber qué campaña trajo a cada mesa.
   *
   * No entrega ni un dato de ninguna persona: son conteos por origen y campaña.
   */
  @Get('analytics/por-origen')
  @RequiereArea('reservations.medicion', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async asistenciaPorOrigen(@Req() req: AuthenticatedRequest, @Query() query: ReservationScopeDto) {
    const scope = await this.requestedScope(req, query.clientId);
    return this.service.asistenciaPorOrigen(req.organizationId, scope.clientId, scope.clientIds, query.days ? Number(query.days) : 90);
  }

  @Get('analytics/occupancy')
  @RequiereArea('reservations.medicion', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async occupancy(@Req() req: AuthenticatedRequest, @Query() query: OccupancyQueryDto) {
    const scope = await this.requestedScope(req, query.clientId);
    if (query.formId) await this.service.getForm(req.organizationId, query.formId, scope.clientId, scope.clientIds);
    return this.service.occupancyCalendar(req.organizationId, query.month, scope.clientId, scope.clientIds, query.formId);
  }

  /** Revisión de encuestas post-visita con calificación baja. */
  @Get('survey-contact-requests')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  async surveyContacts(@Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    const scope = await this.requestedScope(req, clientId);
    return this.service.listSurveyContactRequests(req.organizationId, scope.clientId, scope.clientIds);
  }

  @Put('survey-contact-requests/:id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  async updateSurveyContact(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateContactRequestDto,
  ) {
    const scope = await this.scope(req);
    return this.service.updateSurveyContactRequest(req.organizationId, id, body, scope.clientId, scope.clientIds, req.user.id);
  }

  /** Una reserva concreta: es a donde lleva tocar un aviso de reserva nueva, cancelada o reagendada. */
  @Get(':id')
  @RequiereArea('reservations.reservas', 'ver')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async getReservation(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    const scope = await this.scope(req);
    const reserva = await this.service.getReservation(req.organizationId, id, scope.clientId, scope.clientIds);
    // Recortada, como al crearla y al editarla: es la misma reserva mirada por la misma persona,
    // y la ficha es justo donde el teléfono, el documento y las alergias están a la vista.
    return this.recortada(req, reserva);
  }
}
