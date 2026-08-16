import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { Survey as SurveyContract, SurveyResponse as SurveyResponseContract } from '@espartanos/shared';
import { Public } from '../../core/auth/decorators/public.decorator';
import { Survey } from './survey.entity';
import { SurveyResponse } from './survey-response.entity';
import { SubmitSurveyResponseDto } from './dto/survey.dto';

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
  ) {}

  private toContract(survey: Survey): SurveyContract {
    return {
      id: survey.id,
      title: survey.title,
      type: survey.type,
      questions: survey.questions ?? [],
      status: survey.status,
      createdAt: survey.createdAt.toISOString(),
      createdBy: survey.createdBy,
      distribution: survey.distribution ?? undefined,
      publicUrl: publicSurveyUrl(survey.id),
      ga4MeasurementId: survey.ga4MeasurementId ?? null,
      responses: survey.responseCount,
      designConfig: survey.designConfig ?? undefined,
      googleReview: survey.googleReview ?? undefined,
    } as SurveyContract;
  }

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async detail(@Param('id') id: string) {
    const survey = await this.surveys.findOne({ where: { id } });
    if (!survey || survey.status !== 'active') throw new NotFoundException('La encuesta no está disponible');
    return this.toContract(survey);
  }

  @Post(':id/responses')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async submit(@Param('id') id: string, @Body() dto: SubmitSurveyResponseDto) {
    const survey = await this.surveys.findOne({ where: { id } });
    if (!survey || survey.status !== 'active') throw new NotFoundException('La encuesta no está disponible');

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

    const saved = await this.responses.manager.transaction(async (manager) => {
      const response = await manager.save(manager.create(SurveyResponse, {
        organizationId: survey.organizationId,
        surveyId: survey.id,
        respondentId: `public:${(dto.respondentId?.trim() || 'link').slice(0, 40)}:${randomUUID()}`.slice(0, 100),
        answers: dto.answers ?? {},
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
