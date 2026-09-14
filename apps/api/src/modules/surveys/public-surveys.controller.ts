import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { encuestaPublicaDisponible } from './encuestas-de-la-empresa';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { Survey as SurveyContract, SurveyResponse as SurveyResponseContract } from '@espartanos/shared';
import { Public } from '../../core/auth/decorators/public.decorator';
import { Survey } from './survey.entity';
import { SurveyResponse } from './survey-response.entity';
import { CompleteSurveyResponseDto, StartSurveyResponseDto, SubmitSurveyResponseDto } from './dto/survey.dto';
import { PublicSurveyFlowService } from './public-survey-flow.service';
import { problemasDeRespuesta } from '@espartanos/shared';
import { aceptacionAGuardar, consentimientoDeEncuesta, contactoEscrito } from './consentimiento-de-encuesta';

function publicSurveyUrl(id: string): string | undefined {
  const publicOrigin = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
  return publicOrigin ? `${publicOrigin}/survey/${encodeURIComponent(id)}` : undefined;
}

@Public()
@ApiTags('Encuestas públicas')
@Controller('public/surveys')
export class PublicSurveysController {
  constructor(
    @InjectRepository(Survey) private readonly surveys: Repository<Survey>,
    @InjectRepository(SurveyResponse) private readonly responses: Repository<SurveyResponse>,
    private readonly flujo: PublicSurveyFlowService,
  ) {}

  /** Guarda la nota y responde qué ofrecer después. */
  @Post(':id/start')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async start(@Param('id') id: string, @Body() dto: StartSurveyResponseDto) {
    return this.flujo.iniciar(id, dto.rating, dto.invitacion, dto.origen);
  }

  /** Completa la respuesta iniciada con su token: preguntas, mensaje al equipo o cierre. */
  @Post(':id/responses/:responseId/complete')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async complete(@Param('id') id: string, @Param('responseId') responseId: string, @Body() dto: CompleteSurveyResponseDto) {
    return this.flujo.completar(id, responseId, dto.token, dto);
  }

  /**
   * Lo que ve quien va a responder, que es menos de lo que ve el equipo.
   *
   * Antes devolvía el contrato completo, y ahí viajaban tres cosas que no le incumben a quien
   * abre el enlace: **quién de la agencia la creó** —un identificador de una persona real—,
   * **cuántas respuestas lleva** y **a quién se distribuyó**. Nada de eso hace falta para
   * contestar, y el recuento además informa a cualquiera de cómo le está yendo a esa campaña.
   *
   * Se arma explícitamente en vez de quitar campos del objeto completo: así, un campo nuevo en la
   * encuesta no se publica solo por haberse añadido.
   */
  private async toContract(survey: Survey): Promise<SurveyContract> {
    return {
      id: survey.id,
      title: survey.title,
      type: survey.type,
      questions: survey.questions ?? [],
      status: survey.status,
      publicUrl: publicSurveyUrl(survey.id),
      // Necesario para medir la respuesta desde la propia página, y no identifica a nadie.
      ga4MeasurementId: survey.ga4MeasurementId ?? null,
      designConfig: survey.designConfig ?? undefined,
      googleReview: survey.googleReview ?? undefined,
      // Sólo si pide datos personales: el texto exacto que se acepta.
      consentimiento: await consentimientoDeEncuesta(this.surveys.manager, survey),
    } as SurveyContract;
  }

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async detail(@Param('id') id: string) {
    const survey = await this.surveys.findOne({ where: { id } });
    if (!survey || survey.status !== 'active') throw new NotFoundException('La encuesta no está disponible');
    await encuestaPublicaDisponible(this.surveys, survey.clientId);
    return this.toContract(survey);
  }

  @Post(':id/responses')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async submit(@Param('id') id: string, @Body() dto: SubmitSurveyResponseDto) {
    const survey = await this.surveys.findOne({ where: { id } });
    if (!survey || survey.status !== 'active') throw new NotFoundException('La encuesta no está disponible');
    await encuestaPublicaDisponible(this.surveys, survey.clientId);

    const known = new Set((survey.questions ?? []).map((question) => question.id));
    const unknown = Object.keys(dto.answers ?? {}).filter((key) => !known.has(key));
    if (unknown.length > 0) throw new BadRequestException(`La encuesta no tiene las preguntas: ${unknown.join(', ')}`);

    // Obligatorias según lo que la persona vio, y datos de contacto con formato válido.
    const problemas = problemasDeRespuesta(survey.questions ?? [], dto.answers ?? {});
    if (problemas.length > 0) throw new BadRequestException(problemas.join(' · '));
    let aceptacion: { privacyConsentAt?: Date; privacyConsentText?: string };
    try {
      aceptacion = await aceptacionAGuardar(this.surveys.manager, survey, dto.answers ?? {}, dto.aceptaPrivacidad);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Falta aceptar el uso de tus datos');
    }
    const escrito = contactoEscrito(survey.questions ?? [], dto.answers ?? {});

    const saved = await this.responses.manager.transaction(async (manager) => {
      const response = await manager.save(manager.create(SurveyResponse, {
        organizationId: survey.organizationId,
        surveyId: survey.id,
        respondentId: `public:${(dto.respondentId?.trim() || 'link').slice(0, 40)}:${randomUUID()}`.slice(0, 100),
        answers: dto.answers ?? {},
        respondentName: escrito.nombre ?? null,
        respondentEmail: escrito.correo ?? null,
        ...aceptacion,
      }));
      await manager.increment(Survey, { id: survey.id }, 'responseCount', 1);
      return response;
    });

    return {
      surveyId: saved.surveyId,
      respondentId: saved.respondentId,
      answers: saved.answers,
      submittedAt: saved.submittedAt.toISOString(),
    } satisfies SurveyResponseContract;
  }
}
