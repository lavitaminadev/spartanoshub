import { BadRequestException, Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateLeadUseCase } from './use-cases/create-lead.use-case';
import { ListLeadsUseCase } from './use-cases/list-leads.use-case';
import { ConvertLeadUseCase } from './use-cases/convert-lead.use-case';
import { UpdateLeadUseCase } from './use-cases/update-lead.use-case';
import { GetLeadUseCase } from './use-cases/get-lead.use-case';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ImportLeadsDto } from './dto/import-leads.dto';
import { ImportLeadsUseCase } from './use-cases/import-leads.use-case';
import { ListLeadsQueryDto } from './dto/list-leads.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Reservation } from '../../reservations/domain/reservation.entity';
import { Lead } from './lead.entity';
import { RequiresPermission } from '../../../core/authorization/requires-permission.decorator';
import { LeadTaskSummaryService } from './lead-task-summary.service';
import { CLAVE_ABANDONO, CLAVE_ALERTA, CLAVE_AVISO, PLAZOS_POR_DEFECTO, inactividadDe } from './inactividad-del-lead';
import { ResponsablesDelCrmService } from './responsables-del-crm.service';
import { veSoloLoSuyo } from './lead-visibility';
import { ClientCapabilityService } from '../../../core/client-scope/client-capability.service';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { ProcessHistoryService } from '../../../core/process-history/process-history.service';
import { ProcessSubject } from '../../../core/process-history/process-stage-change.entity';
import { UserRole } from '../../organizations/user-role.enum';
import { ParameterResolver } from '../../../core/parameters/parameter-resolver.service';

@ApiTags('CRM - Leads')
@Controller('crm/leads')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
/*
  Sin `@Roles`: quién entra lo decide la matriz de permisos, y solo ella.

  Había dos puertas para la misma pregunta. La matriz se abrió a todo el equipo y se dejó su
  recorte en la pantalla de Configuración, pero estos decoradores seguían cerrando por cargo,
  así que las direcciones creativa, de arte y audiovisual recibían 403 en el CRM por más que la
  matriz les diera el módulo. Cambiar un acceso exigía tocar código, que es justo lo que se
  quitó.

  `PermissionGuard` sigue exigiendo el módulo `crm` con el nivel que pide el verbo, el alcance
  por cuenta sigue acotando qué leads se ven, y el cargo de cliente no llega porque su perfil no
  incluye este módulo. Quitar el decorador no abre nada que la matriz no conceda.
*/
@ModuleScope('crm')
export class LeadController {
  constructor(
    private createLead: CreateLeadUseCase,
    private listLeads: ListLeadsUseCase,
    private getLead: GetLeadUseCase,
    private convertLead: ConvertLeadUseCase,
    private updateLead: UpdateLeadUseCase,
    private importLeads: ImportLeadsUseCase,
    @InjectRepository(Reservation) private readonly reservationRepository: Repository<Reservation>,
    private readonly accountAccess: AccountAccessService,
    private readonly history: ProcessHistoryService,
    private readonly leadTasks: LeadTaskSummaryService,
    private readonly parametros: ParameterResolver,
    private readonly capacidades: ClientCapabilityService,
    private readonly responsablesDelCrm: ResponsablesDelCrmService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo lead' })
  async create(@Body() dto: CreateLeadDto, @Req() req: AuthenticatedRequest) {
    /*
     * Las mismas dos comprobaciones que al importar, por el mismo motivo: la empresa llega del
     * navegador y decide de quién es el contacto. Sin ellas, quien crea puede depositarlo en una
     * cuenta que no alcanza con solo cambiar el valor enviado.
     */
    const clientId = req.user.role === UserRole.CLIENT ? req.user.clientId : dto.clientId;
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    await this.capacidades.assert(req.organizationId, clientId, 'crm');
    return this.createLead.execute({
      ...dto,
      // La sesión manda sobre el cuerpo: omitir o falsificar el campo no saca el lead de la
      // empresa del portal.
      clientId,
      domain: req.user.role === UserRole.CLIENT ? 'commercial' : dto.domain,
      organizationId: req.organizationId,
    });
  }

  /**
   * Alta masiva desde un archivo.
   *
   * Devuelve siempre 200 con el detalle de lo que entró y lo que no, incluso si fallaron
   * filas: un archivo con dos correos mal escritos y cuatrocientas filas buenas no es una
   * petición inválida, y responder un error dejaría a quien importa sin saber qué se guardó.
   */
  @Post('import')
  @ApiOperation({ summary: 'Importar prospectos desde un archivo' })
  async import(@Body() dto: ImportLeadsDto, @Req() req: AuthenticatedRequest) {
    // La cuenta se comprueba antes de escribir una sola fila. Es un identificador que llega del
    // navegador y decide a qué cliente quedan atribuidos cientos de contactos: sin esto, quien
    // importa puede escribir en una cuenta que no alcanza con solo cambiar el valor enviado.
    const clientId = req.user.role === UserRole.CLIENT ? req.user.clientId : dto.clientId;
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    // Y que esa empresa tenga CRM: importar cuatrocientos contactos a una que solo lleva
    // reservas los deja en un módulo que esa empresa no tiene, sin nadie que los trabaje.
    await this.capacidades.assert(req.organizationId, clientId, 'crm');
    return this.importLeads.execute(req.organizationId, {
      ...dto,
      clientId,
      domain: req.user.role === UserRole.CLIENT ? 'commercial' : dto.domain,
    });
  }

  /**
   * Lista los leads visibles para el usuario.
   *
   * El resultado queda acotado a las cuentas que el usuario tiene asignadas: un community
   * manager ve solo los contactos de sus clientes, mientras dirección y administración ven
   * toda la organización.
   */
  @Get()
  @ApiOperation({ summary: 'Listar leads' })
  async list(@Query() query: ListLeadsQueryDto, @Req() req: AuthenticatedRequest) {
    await this.assertPortalCrm(req);
    const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    // El portal no decide el tenant con un query string. Aunque mande otro `clientId`, se usa el
    // que viene firmado en su sesión. Para el equipo interno la empresa elegida sigue siendo un
    // filtro permitido, validado contra sus asignaciones por `ListLeadsUseCase`.
    const clientId = req.user.role === UserRole.CLIENT ? req.user.clientId : query.clientId;
    /*
     * Tercera reja: qué servicios tiene contratados la empresa.
     *
     * El rol dice qué módulos alcanza la persona y la cuenta dice qué empresas; esto dice si esa
     * empresa contrató el CRM. Faltaba, así que una empresa que solo lleva reservas acumulaba
     * leads en un CRM que no tiene, y salían mezclados con los de las que sí lo llevan.
     *
     * Pedir una empresa concreta sin CRM se responde diciéndolo. Sin empresa elegida se acota la
     * lista a las que sí lo tienen, en vez de negar todo: el embudo de la agencia —sin empresa—
     * sigue siendo visible, porque la agencia no se contrata servicios a sí misma.
     */
    if (clientId) {
      await this.capacidades.assert(req.organizationId, clientId, 'crm');
    }
    /*
     * Solo se acota el embudo de clientes.
     *
     * El comercial es de la agencia y sus prospectos no tienen empresa: acotarlo a una lista de
     * empresas los dejaría a todos fuera, porque un identificador nulo no pertenece a ninguna
     * lista. La agencia no se contrata servicios a sí misma.
     */
    const esEmbudoAgencia = (query.domain ?? 'commercial') === 'commercial'
      && !clientId
      && allowedClientIds === undefined;
    const acotarPorCapacidad = !esEmbudoAgencia && !clientId;
    const conCrm = acotarPorCapacidad
      ? await this.capacidades.filtrar(req.organizationId, allowedClientIds, 'crm')
      : allowedClientIds;
    const pagina = await this.listLeads.execute(req.organizationId, query.limit, query.offset, {
      status: query.status,
      fitStatus: query.fitStatus,
      source: query.source,
      campaignName: query.campaignName,
      search: query.search,
      assignedTo: query.assignedTo,
      domain: query.domain,
      incluirDescartados: query.incluirDescartados,
      clientId,
      agencyOnly: esEmbudoAgencia,
      allowedClientIds: conCrm,
      // Segunda reja: qué empresas alcanza ya se resolvió arriba; esto decide cuánto ve dentro.
      onlyAssignedTo: veSoloLoSuyo(req.user.role, req.user.crmProfile) ? req.user.id : undefined,
    });

    /*
     * Cada lead sale con su próximo paso y cuántas tareas abiertas le quedan.
     *
     * Va acá y no en una consulta aparte de la pantalla: el tablero dibuja cien tarjetas, y pedir
     * las tareas de cada una por separado son cien peticiones para algo que se mira de reojo.
     * Es una sola consulta agrupada sobre los leads de esta página.
     */
    const tareas = await this.leadTasks.porLead(req.organizationId, pagina.data.map((lead) => lead.id));

    /*
     * Los plazos de inactividad, resueltos una vez para toda la página.
     *
     * El nivel lo calcula el servidor y no la pantalla porque los ajustes solo los puede leer
     * un administrador: un vendedor mirando su tablero no podría consultarlos, y la alerta
     * dependería del cargo de quien mira en vez de del estado del lead.
     */
    const ajustes = await this.parametros.getManyForOrganization(
      [CLAVE_AVISO, CLAVE_ALERTA, CLAVE_ABANDONO],
      req.organizationId,
    );
    const plazos = {
      notice: Number(ajustes.get(CLAVE_AVISO) ?? PLAZOS_POR_DEFECTO.notice),
      warning: Number(ajustes.get(CLAVE_ALERTA) ?? PLAZOS_POR_DEFECTO.warning),
      critical: Number(ajustes.get(CLAVE_ABANDONO) ?? PLAZOS_POR_DEFECTO.critical),
    };
    return {
      ...pagina,
      data: pagina.data.map((lead) => ({
        ...lead,
        openTasks: tareas.get(lead.id)?.openTasks ?? 0,
        nextStep: tareas.get(lead.id)?.nextStep ?? null,
        ...inactividadDe(lead, plazos),
      })),
    };
  }

  /**
   * Quién puede hacerse cargo de un lead en este CRM.
   *
   * Existe aparte de `/users` a propósito. Aquél es de administración: devuelve correo,
   * teléfono, cargo y estado de **toda** la organización, y está reservado a los cargos que
   * administran personas. La ficha solo necesita nombres para llenar un desplegable, así que
   * abrirle aquél al portal habría entregado la libreta de contactos del equipo entero para
   * resolver un `<select>`.
   *
   * **Acota por empresa.** Antes la ficha listaba la organización completa, de modo que el CRM
   * de una empresa ofrecía como responsables a personas de otra: se asignaba un lead a alguien
   * que no lo iba a ver nunca, porque su alcance de cuenta no llega a esa empresa.
   *
   * - En el CRM de una empresa devuelve a **su** gente.
   * - En el embudo propio de la agencia devuelve al equipo interno, que es de quien es ese
   *   embudo.
   *
   * Declarado antes de `:id` porque ese comodín capturaría «responsables» como identificador.
   *
   * @returns Identificador y nombre, nada más. Es lo único que la pantalla dibuja.
   */
  @Get('responsables')
  @ApiOperation({ summary: 'Personas asignables en el CRM de una empresa' })
  async responsables(@Req() req: AuthenticatedRequest, @Query('clientId') solicitado?: string) {
    await this.assertPortalCrm(req);
    // El portal no elige empresa: la suya viene firmada en la sesión y un query string no la
    // cambia. Es la misma regla que gobierna el listado de leads.
    const clientId = req.user.role === UserRole.CLIENT ? req.user.clientId : solicitado;
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    if (clientId) await this.capacidades.assert(req.organizationId, clientId, 'crm');
    return this.responsablesDelCrm.execute(req.organizationId, clientId);
  }

  /** Devuelve un lead, siempre que pertenezca a una cuenta accesible para el usuario. */
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un lead' })
  async getById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.assertPortalCrm(req);
    const lead = await this.getLead.execute(id, req.organizationId);
    await this.assertLeadAccess(req, lead);
    return lead;
  }

  /**
   * Recorrido del lead por el embudo, del más antiguo al más reciente.
   *
   * Se lee como una historia y no como un registro técnico: interesa por dónde pasó y cuánto
   * tardó, no cuál fue lo último. Cada paso trae la duración de la etapa que abandona, calculada
   * al escribirse, así que la ficha no tiene que restar fechas para mostrarla.
   */
  @Get(':id/historial')
  @ApiOperation({ summary: 'Historial de etapas de un lead' })
  async historial(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.assertPortalCrm(req);
    // El mismo control de acceso que el detalle: conocer un identificador no debe alcanzar para
    // leer por dónde pasó un lead de una cuenta ajena.
    await this.assertLeadAccess(req, await this.getLead.execute(id, req.organizationId));
    const pasos = await this.history.timeline(ProcessSubject.LEAD, id);
    /*
     * A la empresa no se le dice quién de la agencia movió cada etapa.
     *
     * Quién atiende sus leads es cómo se organiza su proveedor, no información suya. El id salía
     * igual y la pantalla lo resolvía a un nombre o a un cargo, así que el reparto interno se
     * leía de todas formas. Se omite en el origen: lo que no viaja no se puede mostrar por
     * descuido en otra pantalla.
     *
     * El rastro completo sigue en la auditoría, que la empresa no alcanza.
     */
    if (req.user.role !== UserRole.CLIENT) return pasos;
    return pasos.map(({ changedBy: _oculto, ...resto }) => resto);
  }

  /** Actualiza estado, calidad o etiquetas de un lead de una cuenta accesible. */
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar estado de un lead' })
  async update(@Param('id') id: string, @Body() dto: UpdateLeadDto, @Req() req: AuthenticatedRequest) {
    await this.assertPortalCrm(req);
    const lead = await this.assertLeadAccess(req, await this.getLead.execute(id, req.organizationId));
    // Se comprueban las dos cuentas, no solo la de origen: sin verificar el destino, mover un
    // lead a una cuenta ajena sería una forma de sacarlo del alcance de quien lo estaba viendo
    // —o de meterlo en el de otro equipo— con un solo campo.
    if (req.user.role === UserRole.CLIENT && dto.clientId !== undefined && dto.clientId !== req.user.clientId) {
      throw new ForbiddenException('El portal no puede mover contactos fuera de su empresa');
    }
    const clientIdDestino = dto.clientId !== undefined ? (dto.clientId ?? undefined) : (lead.clientId ?? undefined);
    await this.accountAccess.assertClient(req.organizationId, req.user, clientIdDestino);
    // Mover un lead a una empresa sin CRM lo haría desaparecer de toda pantalla salvo la base.
    await this.capacidades.assert(req.organizationId, clientIdDestino, 'crm');
    return this.updateLead.execute(id, dto, req.organizationId, req.user.id);
  }

  /**
   * Verifica que el lead pertenezca a una cuenta accesible para el usuario.
   *
   * Los leads sin cliente asignado corresponden al pipeline comercial de la agencia y solo
   * los alcanzan los usuarios sin restricción de cuentas.
   *
   * @returns El mismo lead, ya validado, para poder encadenar la llamada.
   * @throws NotFoundException cuando el lead no existe o queda fuera del alcance.
   */
  private async assertLeadAccess(req: AuthenticatedRequest, lead: Lead | null): Promise<Lead> {
    if (!lead) throw new NotFoundException('Lead no encontrado');
    /*
     * Quien está acotado a lo suyo tampoco alcanza el de un compañero por identificador.
     *
     * Filtrar solo el listado dejaría la reja a medias: los identificadores aparecen en enlaces,
     * en exportaciones y en la barra de direcciones, y el detalle de un lead trae su teléfono,
     * su monto y sus notas. Se responde «no encontrado» y no «sin permiso», que es lo mismo que
     * hace el filtro por cuenta: decir que existe ya es contar algo.
     */
    if (veSoloLoSuyo(req.user.role, req.user.crmProfile) && lead.assignedTo && lead.assignedTo !== req.user.id) {
      throw new NotFoundException('Lead no encontrado');
    }
    const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    if (allowedClientIds === undefined) return lead;
    if (!lead.clientId || !allowedClientIds.includes(lead.clientId)) {
      throw new NotFoundException('Lead no encontrado');
    }
    return lead;
  }

  /** El portal toma la empresa de su sesión, nunca de un query string opcional. */
  private async assertPortalCrm(req: AuthenticatedRequest): Promise<void> {
    if (req.user.role !== UserRole.CLIENT) return;
    if (!req.user.clientId) throw new ForbiddenException('La cuenta cliente no está asociada a una empresa');
    await this.capacidades.assert(req.organizationId, req.user.clientId, 'crm');
  }

  /**
   * Reservas asociadas a un lead.
   *
   * El cruce se hace por correo o teléfono y se acota además al cliente del lead: una misma
   * persona puede haber reservado con varios clientes de la organización.
   */
  @Get(':id/reservations')
  @ApiOperation({ summary: 'Historial de reservas de un lead' })
  async reservations(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.assertPortalCrm(req);
    const lead = await this.assertLeadAccess(req, await this.getLead.execute(id, req.organizationId));
    const conditions: string[] = [];
    const params: Record<string, string> = { organizationId: req.organizationId };
    if (lead.email) { conditions.push('r.guest_email = :email'); params.email = lead.email; }
    if (lead.phone) { conditions.push('r.guest_phone = :phone'); params.phone = lead.phone; }
    if (conditions.length === 0) return [];
    const query = this.reservationRepository.createQueryBuilder('r')
      .where('r.organization_id = :organizationId', params)
      .andWhere(`(${conditions.join(' OR ')})`);
    if (lead.clientId) query.andWhere('r.client_id = :clientId', { clientId: lead.clientId });
    return query
      .orderBy('r.starts_at', 'DESC')
      .take(50)
      .getMany();
  }

  @Post(':id/convert')
  @RequiresPermission('crm', 'manage')
  @ApiOperation({ summary: 'Convertir lead a cliente' })
  async convert(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.assertPortalCrm(req);
    const lead = await this.assertLeadAccess(req, await this.getLead.execute(id, req.organizationId));
    if (lead.clientId) {
      throw new BadRequestException('Los contactos de una empresa se cierran como venta; no crean empresas de Espartanos');
    }
    return this.convertLead.execute(id, req.organizationId);
  }
}
