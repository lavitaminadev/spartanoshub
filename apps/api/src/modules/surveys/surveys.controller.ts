import {
  BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { computeSurveyResults, type Survey as SurveyContract, type SurveyResponse as SurveyResponseContract } from '@espartanos/shared';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../core/authorization/roles.decorator';
import { ModuleScope } from '../../core/authorization/module-scope.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { Survey } from './survey.entity';
import { SurveyResponse } from './survey-response.entity';
import { CreateSurveyDto, SubmitSurveyResponseDto, UpdateSurveyDto } from './dto/survey.dto';
import type { AuthenticatedRequest } from '../../shared/types/request';

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
  ) {}

  /** Traduce la fila a la forma que el frontend ya consume, con el conteo desnormalizado. */
  private toContract(survey: Survey): SurveyContract {
    return {
      id: survey.id,
      title: survey.title,
      type: survey.type,
      questions: survey.questions ?? [],
      status: survey.status,
      createdAt: survey.createdAt.toISOString(),
      createdBy: survey.createdBy,
      recipients: survey.recipients ?? undefined,
      distribution: survey.distribution ?? undefined,
      responses: survey.responseCount,
      designConfig: survey.designConfig ?? undefined,
      googleReview: survey.googleReview ?? undefined,
    } as SurveyContract;
  }

  private async findOwned(id: string, organizationId: string): Promise<Survey> {
    const survey = await this.surveys.findOne({ where: { id, organizationId } });
    if (!survey) throw new NotFoundException('La encuesta no existe');
    return survey;
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  @ApiOperation({ summary: 'Listar encuestas' })
  async list(@Req() req: AuthenticatedRequest) {
    const rows = await this.surveys.find({
      where: { organizationId: req.organizationId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => this.toContract(row));
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  @ApiOperation({ summary: 'Leer una encuesta' })
  async detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.toContract(await this.findOwned(id, req.organizationId));
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  @ApiOperation({ summary: 'Crear una encuesta' })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSurveyDto) {
    this.assertUniqueQuestionIds(dto.questions);
    const saved = await this.surveys.save(this.surveys.create({
      organizationId: req.organizationId,
      title: dto.title,
      type: dto.type,
      questions: dto.questions,
      status: 'draft',
      // Quién la creó lo dice la sesión, no el cuerpo: aceptarlo del cliente permitiría
      // atribuir una encuesta a otra persona.
      createdBy: req.user.id,
      recipients: dto.recipients ?? null,
      distribution: dto.distribution ?? null,
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
    const survey = await this.findOwned(id, req.organizationId);
    if (dto.questions) {
      this.assertUniqueQuestionIds(dto.questions);
      // Cambiar las preguntas de una encuesta que ya tiene respuestas dejaría los resultados
      // agregando contra ids que ya no existen, sin forma de saber a qué contestó cada quien.
      if (survey.responseCount > 0) {
        throw new BadRequestException('No se pueden cambiar las preguntas de una encuesta que ya tiene respuestas');
      }
      survey.questions = dto.questions;
    }
    if (dto.title !== undefined) survey.title = dto.title;
    if (dto.type !== undefined) survey.type = dto.type;
    if (dto.status !== undefined) survey.status = dto.status;
    if (dto.recipients !== undefined) survey.recipients = dto.recipients;
    if (dto.distribution !== undefined) survey.distribution = dto.distribution;
    if (dto.designConfig !== undefined) survey.designConfig = dto.designConfig;
    if (dto.googleReview !== undefined) survey.googleReview = dto.googleReview;
    return this.toContract(await this.surveys.save(survey));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
  @ApiOperation({ summary: 'Eliminar una encuesta' })
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const survey = await this.findOwned(id, req.organizationId);
    // Las respuestas se van con la encuesta: sin sus preguntas no se pueden interpretar, y
    // conservarlas sueltas solo dejaría filas que nadie puede leer.
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(SurveyResponse, { surveyId: survey.id });
      await manager.remove(survey);
    });
    return { removed: true };
  }

  @Get(':id/results')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMERCIAL_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  @ApiOperation({ summary: 'Resultados agregados de una encuesta' })
  async results(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const survey = await this.findOwned(id, req.organizationId);
    const rows = await this.responses.find({ where: { surveyId: survey.id }, order: { submittedAt: 'ASC' } });
    const responses: SurveyResponseContract[] = rows.map((row) => ({
      surveyId: row.surveyId,
      respondentId: row.respondentId,
      answers: row.answers ?? {},
      submittedAt: row.submittedAt.toISOString(),
    }));
    // La misma función que usa el frontend para su respaldo local: un solo cálculo evita que
    // el panel muestre un NPS y la copia sin red muestre otro.
    return computeSurveyResults(this.toContract(survey), responses);
  }

  @Post(':id/responses')
  @Roles(...Object.values(UserRole))
  @ApiOperation({ summary: 'Registrar una respuesta' })
  async submit(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: SubmitSurveyResponseDto) {
    const survey = await this.findOwned(id, req.organizationId);
    if (survey.status !== 'active') throw new BadRequestException('La encuesta no está recibiendo respuestas');

    const known = new Set((survey.questions ?? []).map((question) => question.id));
    const unknown = Object.keys(dto.answers ?? {}).filter((key) => !known.has(key));
    if (unknown.length > 0) throw new BadRequestException(`La encuesta no tiene las preguntas: ${unknown.join(', ')}`);

    const missing = (survey.questions ?? [])
      .filter((question) => question.required)
      .filter((question) => {
        const value = dto.answers?.[question.id];
        return value === undefined || value === null || value === '';
      });
    if (missing.length > 0) throw new BadRequestException('Faltan respuestas obligatorias');

    const saved = await this.dataSource.transaction(async (manager) => {
      const response = await manager.save(manager.create(SurveyResponse, {
        organizationId: req.organizationId,
        surveyId: survey.id,
        respondentId: dto.respondentId?.trim() || req.user.id,
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

  /** Las respuestas se guardan contra el id de la pregunta; repetirlo las volvería ambiguas. */
  private assertUniqueQuestionIds(questions: Array<{ id: string }>): void {
    const ids = questions.map((question) => question.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Cada pregunta debe tener un identificador distinto');
    }
  }
}
