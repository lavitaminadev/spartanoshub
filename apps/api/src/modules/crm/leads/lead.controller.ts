import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req, NotFoundException } from '@nestjs/common';
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
import { Roles } from '../../../core/authorization/roles.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Reservation } from '../../reservations/domain/reservation.entity';
import { Lead } from './lead.entity';
import { LeadTaskSummaryService } from './lead-task-summary.service';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';
import { ProcessHistoryService } from '../../../core/process-history/process-history.service';
import { ProcessSubject } from '../../../core/process-history/process-stage-change.entity';

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
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo lead' })
  create(@Body() dto: CreateLeadDto, @Req() req: AuthenticatedRequest) {
    return this.createLead.execute({ ...dto, organizationId: req.organizationId });
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
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    return this.importLeads.execute(req.organizationId, dto);
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
    const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    const pagina = await this.listLeads.execute(req.organizationId, query.limit, query.offset, {
      status: query.status,
      fitStatus: query.fitStatus,
      source: query.source,
      domain: query.domain,
      clientId: query.clientId,
      allowedClientIds,
    });

    /*
     * Cada lead sale con su próximo paso y cuántas tareas abiertas le quedan.
     *
     * Va acá y no en una consulta aparte de la pantalla: el tablero dibuja cien tarjetas, y pedir
     * las tareas de cada una por separado son cien peticiones para algo que se mira de reojo.
     * Es una sola consulta agrupada sobre los leads de esta página.
     */
    const tareas = await this.leadTasks.porLead(req.organizationId, pagina.data.map((lead) => lead.id));
    return {
      ...pagina,
      data: pagina.data.map((lead) => ({
        ...lead,
        openTasks: tareas.get(lead.id)?.openTasks ?? 0,
        nextStep: tareas.get(lead.id)?.nextStep ?? null,
      })),
    };
  }

  /** Devuelve un lead, siempre que pertenezca a una cuenta accesible para el usuario. */
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un lead' })
  async getById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
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
    // El mismo control de acceso que el detalle: conocer un identificador no debe alcanzar para
    // leer por dónde pasó un lead de una cuenta ajena.
    await this.assertLeadAccess(req, await this.getLead.execute(id, req.organizationId));
    return this.history.timeline(ProcessSubject.LEAD, id);
  }

  /** Actualiza estado, calidad o etiquetas de un lead de una cuenta accesible. */
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar estado de un lead' })
  async update(@Param('id') id: string, @Body() dto: UpdateLeadDto, @Req() req: AuthenticatedRequest) {
    await this.assertLeadAccess(req, await this.getLead.execute(id, req.organizationId));
    // Se comprueban las dos cuentas, no solo la de origen: sin verificar el destino, mover un
    // lead a una cuenta ajena sería una forma de sacarlo del alcance de quien lo estaba viendo
    // —o de meterlo en el de otro equipo— con un solo campo.
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId ?? undefined);
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
    const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    if (allowedClientIds === undefined) return lead;
    if (!lead.clientId || !allowedClientIds.includes(lead.clientId)) {
      throw new NotFoundException('Lead no encontrado');
    }
    return lead;
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
  @ApiOperation({ summary: 'Convertir lead a cliente' })
  convert(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.convertLead.execute(id, req.organizationId);
  }
}
