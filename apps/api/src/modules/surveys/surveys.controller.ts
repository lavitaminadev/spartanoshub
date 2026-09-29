import { randomUUID } from 'crypto';
import { PermissionResolverService } from '../../core/authorization/permission-resolver.service';
import {
  BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { exigirIdentidadLegalDeEncuesta } from './consentimiento-de-encuesta';
import { AuditService } from '../../core/audit/audit.service';
import { CompanyLegalDto, CompanyLegalScopeDto, empresaDelPortal, asegurarQueAdministraLaEmpresa, guardarDatosLegales, leerDatosLegales } from '../clients/datos-legales-de-empresa';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { computeSurveyResults, type Survey as SurveyContract, type SurveyResponse as SurveyResponseContract } from '@espartanos/shared';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../core/authorization/roles.decorator';
import { RequiresPermission } from '../../core/authorization/requires-permission.decorator';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { aplicarEdicionDePreguntas, MAXIMO_HISTORIAL, problemasDeRespuesta, type SurveyQuestion } from '@espartanos/shared';
import { Survey } from './survey.entity';
import { SurveyResponse } from './survey-response.entity';
import { CreateSurveyDto, SubmitSurveyResponseDto, UpdateSurveyDto, AttendSurveyResponseDto } from './dto/survey.dto';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { EmailService } from '../../core/notifications/email.service';
import { componerCorreo } from '../../core/notifications/plantilla-de-correo';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';
import { leerPlantilla } from '../../core/parameters/plantilla-resuelta';
import { exigirEncuestasHabilitadas } from './encuestas-de-la-empresa';
import { In, IsNull } from 'typeorm';
import { RequiereAccion } from '../../core/authorization/requiere-accion';

/** Correo plausible. La validación real la hace el servidor de correo; esto evita basura obvia. */
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Cuántos se envían por pedido. Más que esto no es distribuir una encuesta, es una campaña. */
export const MAXIMO_ENVIO_POR_PEDIDO = 500;

function publicSurveyUrl(id: string): string | undefined {
  const publicOrigin = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
  return publicOrigin ? `${publicOrigin}/survey/${encodeURIComponent(id)}` : undefined;
}

/**
 * Encuestas propias del producto.
 *
 * Distintas de la encuesta post-visita, que pertenece al circuito de una reserva y se
 * responde desde su página pública. Estas se crean, distribuyen y cierran por sí solas.
 */
@ApiTags('Encuestas')
@Controller('surveys')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@ModuleScope('surveys')
export class SurveysController {
  constructor(
    @InjectRepository(Survey) private readonly surveys: Repository<Survey>,
    @InjectRepository(SurveyResponse) private readonly responses: Repository<SurveyResponse>,
    private readonly dataSource: DataSource,
    private readonly accountAccess: AccountAccessService,
    private readonly correo: EmailService,
    private readonly audit: AuditService,
    private readonly parametros: ParameterResolver,
    private readonly permisos: PermissionResolverService,
  ) {}

  /** Traduce la fila a la forma que el frontend ya consume, con el conteo desnormalizado. */
  private toContract(survey: Survey): SurveyContract {
    return {
      id: survey.id,
      clientId: survey.clientId ?? undefined,
      title: survey.title,
      type: survey.type,
      questions: survey.questions ?? [],
      status: survey.status,
      createdAt: survey.createdAt.toISOString(),
      createdBy: survey.createdBy,
      recipients: survey.recipients ?? undefined,
      distribution: survey.distribution ?? undefined,
      publicUrl: publicSurveyUrl(survey.id),
      ga4MeasurementId: survey.ga4MeasurementId ?? null,
      anonymous: Boolean(survey.anonymous),
      responses: survey.responseCount,
      designConfig: survey.designConfig ?? undefined,
      googleReview: survey.googleReview ?? undefined,
      historial: survey.changeLog ?? [],
    } as SurveyContract;
  }

  /**
   * La encuesta, sólo si quien pregunta alcanza su empresa.
   *
   * Antes bastaba con ser de la organización: alguien asignado a una empresa leía, editaba y
   * veía las respuestas —con nombre y correo— de las encuestas de cualquier otra. Responde 404
   * igual que una que no existe, para no revelar la cartera.
   */
  private async findOwned(id: string, req: AuthenticatedRequest): Promise<Survey> {
    const survey = await this.surveys.findOne({ where: { id, organizationId: req.organizationId } });
    if (!survey) throw new NotFoundException('La encuesta no existe');
    if (req.user.role === UserRole.CLIENT) {
      if (!survey.clientId || survey.clientId !== req.user.clientId) throw new NotFoundException('La encuesta no existe');
      await exigirEncuestasHabilitadas(this.dataSource, survey.clientId);
    }
    if (survey.clientId) {
      const permitidas = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
      if (permitidas !== undefined && !permitidas.includes(survey.clientId)) throw new NotFoundException('La encuesta no existe');
    }
    return survey;
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  @ApiOperation({ summary: 'Listar encuestas' })
  async list(@Req() req: AuthenticatedRequest, @Query('clientId') clientId?: string) {
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    // Sin empresa elegida, cada persona ve las de sus empresas y las internas del equipo; no las
    // de toda la organización.
    const permitidas = clientId ? undefined : await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    // El portal ve sólo las de su empresa: nunca las internas del equipo.
    if (req.user.role === UserRole.CLIENT) {
      if (!req.user.clientId) return [];
      await exigirEncuestasHabilitadas(this.dataSource, req.user.clientId);
      const propias = await this.surveys.find({ where: { organizationId: req.organizationId, clientId: req.user.clientId }, order: { createdAt: 'DESC' } });
      return propias.map((row) => this.toContract(row));
    }
    const where = clientId
      ? { organizationId: req.organizationId, clientId }
      : permitidas === undefined
        ? { organizationId: req.organizationId }
        : [{ organizationId: req.organizationId, clientId: IsNull() }, ...(permitidas.length ? [{ organizationId: req.organizationId, clientId: In(permitidas) }] : [])];
    const rows = await this.surveys.find({ where, order: { createdAt: 'DESC' } });
    return rows.map((row) => this.toContract(row));
  }

  /**
   * Datos legales de la empresa (compartidos con Reservas, que tiene su propia ruta).
   *
   * Va antes de `:id` para que la ruta no se lea como el id de una encuesta.
   */
  @Get('company-legal')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async companyLegal(@Req() req: AuthenticatedRequest, @Query() query: CompanyLegalScopeDto) {
    return leerDatosLegales(this.dataSource, req.organizationId, await this.empresaLegal(req, query.clientId));
  }

  @Put('company-legal')
  // Son los datos de la propia empresa: una empresa con sólo Encuestas (lectura) debe poder mantenerlos.
  @RequiresPermission('surveys', 'view')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async saveCompanyLegal(@Req() req: AuthenticatedRequest, @Query() query: CompanyLegalScopeDto, @Body() dto: CompanyLegalDto) {
    const empresa = await this.empresaLegal(req, query.clientId);
    await asegurarQueAdministraLaEmpresa(this.permisos, req.organizationId, req.user, empresa);
    return guardarDatosLegales(this.dataSource, this.audit, req.organizationId, empresa, { ...dto, aceptaEncargo: req.user.clientId ? dto.aceptaEncargo : undefined }, req.user.id, req.user.name);
  }

  private async empresaLegal(req: AuthenticatedRequest, pedida?: string): Promise<string> {
    if (req.user.role === UserRole.CLIENT) {
      const propia = empresaDelPortal(req.user.clientId);
      await exigirEncuestasHabilitadas(this.dataSource, propia);
      return propia;
    }
    if (!pedida) throw new BadRequestException('Indica la empresa');
    await this.accountAccess.assertClient(req.organizationId, req.user, pedida);
    return pedida;
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  @ApiOperation({ summary: 'Leer una encuesta' })
  async detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.toContract(await this.findOwned(id, req));
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  @ApiOperation({ summary: 'Crear una encuesta' })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSurveyDto) {
    if (dto.type === 'customer' && !dto.clientId) throw new BadRequestException('Las encuestas de clientes requieren una empresa');
    if (dto.type === 'internal' && dto.clientId) throw new BadRequestException('Las encuestas internas no se asignan a una empresa');
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    await exigirEncuestasHabilitadas(this.dataSource, dto.clientId);
    this.assertUniqueQuestionIds(dto.questions);
    const saved = await this.surveys.save(this.surveys.create({
      organizationId: req.organizationId,
      clientId: dto.clientId ?? null,
      title: dto.title,
      type: dto.type,
      questions: dto.questions,
      status: 'draft',
      // Quién la creó lo dice la sesión, no el cuerpo: aceptarlo del cliente permitiría
      // atribuir una encuesta a otra persona.
      createdBy: req.user.id,
      recipients: dto.recipients ?? null,
      distribution: dto.distribution ?? null,
      ga4MeasurementId: dto.ga4MeasurementId?.trim() || null,
      anonymous: dto.anonymous === true,
      responseCount: 0,
      designConfig: dto.designConfig ?? null,
      googleReview: dto.googleReview ?? null,
    }));
    return this.toContract(saved);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  @ApiOperation({ summary: 'Actualizar una encuesta' })
  async update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateSurveyDto) {
    const survey = await this.findOwned(id, req);
    const ahora = new Date().toISOString();
    const cambios: string[] = [];
    if (dto.questions) {
      this.assertUniqueQuestionIds(dto.questions);
      // Con respuestas se edita sin perder nada: lo quitado se archiva y el tipo no cambia.
      const edicion = aplicarEdicionDePreguntas(survey.questions ?? [], dto.questions as SurveyQuestion[], survey.responseCount > 0, ahora);
      if (edicion.error) throw new BadRequestException(edicion.error);
      survey.questions = edicion.preguntas;
      cambios.push(...edicion.cambios);
    }
    if (dto.title !== undefined && dto.title !== survey.title) cambios.push(`Nombre: «${survey.title}» → «${dto.title}»`);
    if (dto.designConfig !== undefined) {
      const antes = (survey.designConfig ?? {}) as Record<string, string>;
      const despues = dto.designConfig as Record<string, string>;
      if ((antes.welcome ?? '') !== (despues.welcome ?? '')) cambios.push('Mensaje de bienvenida actualizado');
      const otras = new Set([...Object.keys(antes), ...Object.keys(despues)].filter((clave) => clave !== 'welcome' && (antes[clave] ?? '') !== (despues[clave] ?? '')));
      if (otras.size) cambios.push(`Diseño actualizado (${[...otras].slice(0, 4).join(', ')}${otras.size > 4 ? '…' : ''})`);
    }
    if (dto.distribution !== undefined && JSON.stringify(dto.distribution ?? []) !== JSON.stringify(survey.distribution ?? [])) cambios.push('Canales de distribución actualizados');
    if (dto.ga4MeasurementId !== undefined && (dto.ga4MeasurementId?.trim() || null) !== (survey.ga4MeasurementId ?? null)) cambios.push('Medición de Google Analytics actualizada');
    if (dto.googleReview !== undefined && JSON.stringify(dto.googleReview ?? null) !== JSON.stringify(survey.googleReview ?? null)) cambios.push('Reseñas en Google actualizadas');
    if (dto.status !== undefined && dto.status !== survey.status) cambios.push(dto.status === 'active' ? 'Encuesta publicada' : dto.status === 'closed' ? 'Encuesta cerrada' : 'Encuesta pasada a borrador');
    /*
     * El anonimato no se puede quitar una vez que hay respuestas.
     *
     * Quien contestó lo hizo porque se le prometió que no se sabría quién; apagarlo después no
     * revela las que ya están —no se guardó a nadie— pero sí volvería identificables las
     * siguientes bajo el mismo título, que es engañar con la misma encuesta. Encenderlo sí se
     * permite siempre: protege más, nunca menos.
     */
    if (dto.anonymous !== undefined && dto.anonymous !== survey.anonymous) {
      if (!dto.anonymous && survey.responseCount > 0) {
        throw new BadRequestException('Esta encuesta ya recibió respuestas anónimas. Para volver a pedir identidad, crea una encuesta nueva: quienes ya contestaron lo hicieron con la promesa de que no se sabría quiénes son.');
      }
      cambios.push(dto.anonymous ? 'Las respuestas pasan a ser anónimas' : 'Las respuestas pasan a quedar identificadas');
    }
    if (cambios.length) {
      const autor = await this.dataSource.query('SELECT name FROM users WHERE id = ? LIMIT 1', [req.user.id]).then((filas: Array<{ name?: string }>) => filas?.[0]?.name ?? null).catch(() => null);
      survey.changeLog = [{ fecha: ahora, autor, cambios }, ...(survey.changeLog ?? [])].slice(0, MAXIMO_HISTORIAL);
    }
    if (dto.title !== undefined) survey.title = dto.title;
    if (dto.type !== undefined) survey.type = dto.type;
    if (dto.clientId !== undefined) {
      await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
      survey.clientId = dto.clientId;
    }
    // Publicar o mover a una empresa sin el servicio no se permite; cerrar o editar textos sí.
    if (dto.clientId !== undefined || dto.status === 'active') await exigirEncuestasHabilitadas(this.dataSource, survey.clientId);
    if (dto.status === 'active' && survey.status !== 'active') await exigirIdentidadLegalDeEncuesta(this.dataSource, survey.clientId, dto.questions ?? survey.questions);
    if (survey.type === 'customer' && !survey.clientId) throw new BadRequestException('Las encuestas de clientes requieren una empresa');
    if (survey.type === 'internal' && survey.clientId) throw new BadRequestException('Las encuestas internas no se asignan a una empresa');
    if (dto.status !== undefined) survey.status = dto.status;
    if (dto.recipients !== undefined) survey.recipients = dto.recipients;
    if (dto.distribution !== undefined) survey.distribution = dto.distribution;
    if (dto.ga4MeasurementId !== undefined) survey.ga4MeasurementId = dto.ga4MeasurementId?.trim() || null;
    if (dto.anonymous !== undefined) survey.anonymous = dto.anonymous;
    if (dto.designConfig !== undefined) survey.designConfig = dto.designConfig;
    if (dto.googleReview !== undefined) survey.googleReview = dto.googleReview;
    return this.toContract(await this.surveys.save(survey));
  }

  @Delete(':id')
  @RequiereAccion('surveys.borrar')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Eliminar una encuesta' })
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const survey = await this.findOwned(id, req);
    // Las respuestas se van con la encuesta: sin sus preguntas no se pueden interpretar, y
    // conservarlas sueltas solo dejaría filas que nadie puede leer.
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(SurveyResponse, { surveyId: survey.id });
      await manager.remove(survey);
    });
    return { removed: true };
  }

  @Get(':id/results')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  @ApiOperation({ summary: 'Resultados agregados de una encuesta' })
  async results(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const survey = await this.findOwned(id, req);
    const rows = await this.responses.find({ where: { surveyId: survey.id }, order: { submittedAt: 'ASC' } });
    const responses: SurveyResponseContract[] = rows.map((row) => ({
      surveyId: row.surveyId,
      respondentId: row.respondentId,
      answers: row.answers ?? {},
      submittedAt: row.submittedAt.toISOString(),
    }));
    /*
     * Cada respuesta con quién la dejó.
     *
     * El agregado dice cuánto; lo que se lee para actuar es qué contestó cada uno, y sobre todo
     * los mensajes privados al equipo, que no aparecen en ningún promedio. Nombre y correo sólo
     * existen cuando la respuesta llegó por la invitación de una reserva: las de enlace o QR
     * siguen anónimas. Los ve sólo quien ya puede ver los resultados.
     */
    // Nombres de quienes atendieron, en una sola consulta.
    const idsQueAtendieron = [...new Set(rows.map((row) => row.attendedBy).filter((valor): valor is string => Boolean(valor)))];
    const nombres = new Map<string, string>();
    if (idsQueAtendieron.length) {
      const filas = await this.dataSource.query(`SELECT id, name FROM users WHERE id IN (${idsQueAtendieron.map(() => '?').join(',')})`, idsQueAtendieron).catch(() => []) as Array<{ id: string; name: string }>;
      for (const fila of filas) nombres.set(fila.id, fila.name);
    }
    // Visitas por canal y día del último año, para comparar con las respuestas en cualquier período.
    const visitas = await this.dataSource.query(
      'SELECT COALESCE(NULLIF(origen, \'\'), \'link\') origen, DATE(created_at) dia, COUNT(*) total FROM survey_visits WHERE survey_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY) GROUP BY origen, dia',
      [survey.id],
    ).catch(() => []) as Array<{ origen: string; dia: string | Date; total: number }>;
    const visitasPorDia = visitas.map((fila) => ({ origen: fila.origen, dia: (fila.dia instanceof Date ? fila.dia.toISOString() : String(fila.dia)).slice(0, 10), total: Number(fila.total) }));
    /*
     * Cuántas veces ha respondido cada persona: en esta encuesta y en todas las de la misma empresa.
     *
     * Quien vuelve una y otra vez no es igual que quien opina una vez, y leerlo sin ese dato hace
     * pasar a un cliente habitual por alguien nuevo. Se cuenta por correo —el único dato que
     * identifica a alguien entre visitas— y sólo dentro de la empresa de la encuesta: lo que la
     * misma persona haya contestado para otro negocio no es asunto de este.
     */
    /*
     * En una encuesta anónima no se devuelve nada que lleve a una persona.
     *
     * Al guardar ya no se escribe quién, así que esto es la segunda reja y no la única: protege el
     * caso de una encuesta que se marcó anónima después de recibir respuestas, donde las
     * anteriores sí traen nombre. El historial se calcula sobre el correo, así que tampoco va.
     */
    const historial = survey.anonymous ? new Map() : await this.historialPorCorreo(survey, rows.map((row) => row.respondentEmail));
    const detalle = rows.slice().reverse().slice(0, 500).map((row) => ({
      historial: !survey.anonymous && row.respondentEmail ? historial.get(row.respondentEmail.trim().toLowerCase()) ?? null : null,
      id: row.id,
      submittedAt: row.submittedAt.toISOString(),
      rating: row.rating ?? null,
      respondentName: survey.anonymous ? null : row.respondentName ?? null,
      respondentEmail: survey.anonymous ? null : row.respondentEmail ?? null,
      reservationId: survey.anonymous ? null : row.reservationId ?? null,
      teamMessage: row.teamMessage ?? null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      privacyConsentAt: row.privacyConsentAt ? row.privacyConsentAt.toISOString() : null,
      // El canal viaja en el id de quien responde: `public:<origen>:<uuid>` o `reserva:<id>`.
      attendedAt: row.attendedAt ? row.attendedAt.toISOString() : null,
      attendedByName: row.attendedBy ? nombres.get(row.attendedBy) ?? null : null,
      origen: row.respondentId.startsWith('reserva:') ? 'reserva' : row.respondentId.startsWith('public:') ? row.respondentId.split(':')[1] || null : null,
      answers: row.answers ?? {},
    }));
    // La misma función que usa el frontend para su respaldo local: un solo cálculo evita que
    // el panel muestre un NPS y la copia sin red muestre otro.
    return { ...computeSurveyResults(this.toContract(survey), responses), respuestas: detalle, visitasPorDia };
  }

  /**
   * Marca una respuesta como atendida, o la vuelve a dejar pendiente.
   *
   * La empresa también puede hacerlo desde su portal: es quien suele contestarle a su cliente.
   */
  @Patch(':id/responses/:responseId/attention')
  // Marcar atendida no modifica la encuesta: basta con poder verla (la empresa tiene lectura).
  @RequiresPermission('surveys', 'view')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async attend(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Param('responseId') responseId: string, @Body() dto: AttendSurveyResponseDto) {
    const survey = await this.findOwned(id, req);
    const respuesta = await this.responses.findOne({ where: { id: responseId, surveyId: survey.id } });
    if (!respuesta) throw new NotFoundException('La respuesta no existe');
    await this.responses.update({ id: respuesta.id }, dto.atendida ? { attendedAt: new Date(), attendedBy: req.user.id } : { attendedAt: null, attendedBy: null });
    return { id: respuesta.id, attendedAt: dto.atendida ? new Date().toISOString() : null, attendedByName: dto.atendida ? await this.nombreDe(req.user.id) : null };
  }

  private async nombreDe(userId: string): Promise<string | null> {
    const filas = await this.dataSource.query('SELECT name FROM users WHERE id = ? LIMIT 1', [userId]).catch(() => []) as Array<{ name?: string }>;
    return filas?.[0]?.name ?? null;
  }

  /**
   * Respuestas de cada persona, contadas dentro de la empresa de la encuesta.
   *
   * La empresa se compara con `<=>` para que las encuestas sin empresa —las internas— se cuenten
   * entre sí y no se mezclen con las de ningún cliente. Si la consulta falla, los resultados se
   * muestran igual, sin el conteo: es un dato que ayuda a leer, no uno sin el que no se pueda.
   *
   * @returns Por correo en minúsculas: en esta encuesta, en toda la empresa, y en cuántas encuestas
   *   distintas de ella.
   */
  private async historialPorCorreo(
    survey: Survey,
    correos: Array<string | null | undefined>,
  ): Promise<Map<string, { enEstaEncuesta: number; enLaEmpresa: number; encuestas: number }>> {
    const unicos = [...new Set(correos.map((correo) => correo?.trim().toLowerCase()).filter((correo): correo is string => Boolean(correo)))];
    const resultado = new Map<string, { enEstaEncuesta: number; enLaEmpresa: number; encuestas: number }>();
    if (unicos.length === 0) return resultado;

    const filas = await this.dataSource.query(
      `SELECT LOWER(TRIM(r.respondent_email)) AS correo, r.survey_id AS encuesta, COUNT(*) AS total
         FROM survey_responses r
         JOIN surveys s ON s.id = r.survey_id
        WHERE r.organization_id = ?
          AND s.client_id <=> ?
          AND LOWER(TRIM(r.respondent_email)) IN (${unicos.map(() => '?').join(',')})
        GROUP BY correo, encuesta`,
      [survey.organizationId, survey.clientId ?? null, ...unicos],
    ).catch(() => []) as Array<{ correo: string; encuesta: string; total: number | string }>;

    for (const fila of filas) {
      const actual = resultado.get(fila.correo) ?? { enEstaEncuesta: 0, enLaEmpresa: 0, encuestas: 0 };
      const total = Number(fila.total) || 0;
      actual.enLaEmpresa += total;
      actual.encuestas += 1;
      if (fila.encuesta === survey.id) actual.enEstaEncuesta = total;
      resultado.set(fila.correo, actual);
    }
    return resultado;
  }

  @Post(':id/responses')
  @Roles(...Object.values(UserRole))
  @ApiOperation({ summary: 'Registrar una respuesta' })
  async submit(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: SubmitSurveyResponseDto) {
    const survey = await this.findOwned(id, req);
    if (survey.status !== 'active') throw new BadRequestException('La encuesta no está recibiendo respuestas');

    const known = new Set((survey.questions ?? []).map((question) => question.id));
    const unknown = Object.keys(dto.answers ?? {}).filter((key) => !known.has(key));
    if (unknown.length > 0) throw new BadRequestException(`La encuesta no tiene las preguntas: ${unknown.join(', ')}`);

    const problemas = problemasDeRespuesta(survey.questions ?? [], dto.answers ?? {});
    if (problemas.length > 0) throw new BadRequestException(problemas.join(' · '));

    const saved = await this.dataSource.transaction(async (manager) => {
      const response = await manager.save(manager.create(SurveyResponse, {
        organizationId: req.organizationId,
        surveyId: survey.id,
        /*
         * Anónima significa que no se guarda quién.
         *
         * No basta con ocultar el nombre al mostrar los resultados: mientras la cuenta quede
         * escrita en la fila, cualquiera con acceso a la base puede deshacerlo, y la promesa que
         * se le hizo a esa persona no era esa. Se guarda un identificador al azar, que sirve para
         * distinguir dos respuestas entre sí y no lleva a nadie.
         */
        respondentId: survey.anonymous ? `anon:${randomUUID()}` : (dto.respondentId?.trim() || req.user.id),
        answers: dto.answers ?? {},
      }));
      // El conteo se incrementa en la base y no sobre el valor leído: dos respuestas
      // simultáneas leerían el mismo número y una de las dos se perdería.
      await manager.increment(Survey, { id: survey.id }, 'responseCount', 1);
      return response;
    });

    return {
      surveyId: saved.surveyId,
      respondentId: saved.respondentId,
      answers: saved.answers,
      submittedAt: saved.submittedAt.toISOString(),
    };
  }

  /**
   * Envía la encuesta por correo a sus destinatarios.
   *
   * El canal «correo» existía como una casilla y un botón que abría el programa de correo propio
   * con el destinatario vacío: los destinatarios escritos en el asistente no se usaban en ninguna
   * parte y nada salía desde el sistema. Ahora sale desde el servidor, uno por persona, con el
   * enlace marcado como `src=email` para distinguirlo en los resultados.
   *
   * Cada correo va sólo a su destinatario —nunca con copia a los demás—: mandar una lista entera
   * en un solo envío expone los correos de todos a todos.
   *
   * Quien lo usa responde por tener permiso para escribirles. La pantalla lo pide confirmar antes.
   */
  @Post(':id/send-email')
  @RequiereAccion('surveys.enviar')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  @ApiOperation({ summary: 'Enviar la encuesta por correo a sus destinatarios' })
  async sendEmail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const survey = await this.findOwned(id, req);
    await exigirEncuestasHabilitadas(this.dataSource, survey.clientId);
    if (survey.status !== 'active') throw new BadRequestException('Activa la encuesta antes de enviarla');
    if (!(survey.distribution ?? []).includes('email')) throw new BadRequestException('Esta encuesta no tiene el correo habilitado como canal');

    const base = publicSurveyUrl(survey.id);
    if (!base) throw new BadRequestException('Falta configurar la dirección pública de la aplicación');

    const unicos = [...new Set((survey.recipients ?? []).map((correo) => correo.trim().toLowerCase()))];
    const validos = unicos.filter((correo) => CORREO.test(correo));
    const invalidos = unicos.length - validos.length;
    if (validos.length === 0) throw new BadRequestException('La encuesta no tiene destinatarios con un correo válido');
    if (validos.length > MAXIMO_ENVIO_POR_PEDIDO) {
      throw new BadRequestException(`Son ${validos.length} destinatarios; el máximo por envío es ${MAXIMO_ENVIO_POR_PEDIDO}.`);
    }

    const enlace = `${base}?src=email`;
    /*
     * La plantilla es la de Correos; el texto de bienvenida que escribió quien armó la encuesta,
     * si lo hay, sigue mandando sobre ella: es lo que esa encuesta en particular quiso decir.
     */
    const plantilla = await leerPlantilla(
      this.parametros,
      'email.survey_invite',
      { clientId: survey.clientId ?? null, organizationId: survey.organizationId },
      { asunto: '{{encuesta}}', cuerpo: 'Nos gustaría saber tu opinión. Es un minuto.' },
      { encendidoPorDefecto: null },
    );
    const { subject, html } = componerCorreo(
      plantilla.asunto,
      survey.designConfig?.welcome || plantilla.cuerpo,
      { encuesta: survey.title },
      { texto: 'Responder la encuesta', url: enlace },
    );

    let enviados = 0;
    let fallidos = 0;
    for (const destino of validos) {
      // Uno por uno: si un destino falla, los demás siguen saliendo.
      const ok = await this.correo.send(destino, subject, html).catch(() => false);
      if (ok) enviados += 1; else fallidos += 1;
    }
    return { enviados, fallidos, invalidos };
  }

  /** Las respuestas se guardan contra el id de la pregunta; repetirlo las volvería ambiguas. */
  private assertUniqueQuestionIds(questions: Array<{ id: string; question: string; type: string; dato?: string; mostrarSi?: { preguntaId: string } }>): void {
    const ids = questions.map((question) => question.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Cada pregunta debe tener un identificador distinto');
    }
    for (const pregunta of questions) {
      if (pregunta.mostrarSi && !questions.some((otra) => otra.id === pregunta.mostrarSi?.preguntaId && otra.id !== pregunta.id)) {
        throw new BadRequestException(`La regla de «${pregunta.question}» apunta a una pregunta que no existe`);
      }
      if (pregunta.dato && pregunta.type !== 'text') throw new BadRequestException('Los datos de contacto deben ser de tipo texto');
    }
  }
}
