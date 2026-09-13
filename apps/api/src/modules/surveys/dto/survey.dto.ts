import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import type { QuestionType, SurveyDistributionChannel, SurveyStatus, SurveyType } from '@espartanos/shared';

const QUESTION_TYPES: QuestionType[] = ['nps', 'rating', 'text', 'multiple-choice'];
const SURVEY_TYPES: SurveyType[] = ['internal', 'customer'];
const SURVEY_STATUSES: SurveyStatus[] = ['draft', 'active', 'closed'];
const CHANNELS: SurveyDistributionChannel[] = ['email', 'qr', 'link'];

export class SurveyQuestionDto {
  /** Identificador estable dentro de la encuesta: las respuestas se guardan contra él. */
  @IsString() @MaxLength(64)
  id: string;

  @IsIn(QUESTION_TYPES)
  type: QuestionType;

  @IsString() @MinLength(1) @MaxLength(500)
  question: string;

  @IsBoolean()
  required: boolean;

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(30)
  options?: string[];
}

export class CreateSurveyDto {
  @IsString() @MinLength(1) @MaxLength(200)
  title: string;

  @IsIn(SURVEY_TYPES)
  type: SurveyType;

  /** Obligatorio para encuestas de clientes nuevas; interno/agencia queda sin empresa. */
  @IsOptional() @IsUUID()
  clientId?: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => SurveyQuestionDto) @ArrayMaxSize(50)
  questions: SurveyQuestionDto[];

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(2000)
  recipients?: string[];

  @IsOptional() @IsArray() @IsIn(CHANNELS, { each: true })
  distribution?: SurveyDistributionChannel[];

  @IsOptional() @Matches(/^(G-[A-Z0-9]{4,20})?$/i, { message: 'El ID de medición GA4 debe tener el formato G-XXXXXXXXXX' })
  ga4MeasurementId?: string;

  @IsOptional() @IsObject()
  designConfig?: Record<string, string>;

  @IsOptional() @IsObject()
  googleReview?: Record<string, unknown>;
}

/**
 * Campos que una encuesta admite cambiar después de creada.
 *
 * `createdBy`, `createdAt` y el conteo de respuestas quedan fuera a propósito: describen lo
 * que ocurrió, no lo que alguien decide, y aceptarlos desde el cliente permitiría reescribir
 * la historia de una encuesta ya distribuida.
 */
export class UpdateSurveyDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  title?: string;

  @IsOptional() @IsIn(SURVEY_TYPES)
  type?: SurveyType;

  @IsOptional() @IsUUID()
  clientId?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SurveyQuestionDto) @ArrayMaxSize(50)
  questions?: SurveyQuestionDto[];

  @IsOptional() @IsIn(SURVEY_STATUSES)
  status?: SurveyStatus;

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(2000)
  recipients?: string[];

  @IsOptional() @IsArray() @IsIn(CHANNELS, { each: true })
  distribution?: SurveyDistributionChannel[];

  @IsOptional() @Matches(/^(G-[A-Z0-9]{4,20})?$/i, { message: 'El ID de medición GA4 debe tener el formato G-XXXXXXXXXX' })
  ga4MeasurementId?: string;

  @IsOptional() @IsObject()
  designConfig?: Record<string, string>;

  @IsOptional() @IsObject()
  googleReview?: Record<string, unknown>;
}

/** Primer paso: sólo la nota. La invitación es opcional; sin ella la respuesta queda anónima. */
export class StartSurveyResponseDto {
  @IsInt() @Min(1) @Max(5)
  rating: number;

  @IsOptional() @IsString() @MaxLength(600)
  invitacion?: string;

  @IsOptional() @IsString() @MaxLength(40)
  origen?: string;
}

/** Pasos siguientes: preguntas, mensaje al equipo, o cerrar. */
export class CompleteSurveyResponseDto {
  @IsString() @MinLength(10) @MaxLength(80)
  token: string;

  @IsOptional() @IsObject()
  answers?: Record<string, string | number>;

  @IsOptional() @IsString() @MaxLength(2000)
  teamMessage?: string;

  /** Si eligió contestar la encuesta: sólo entonces se exigen las obligatorias. */
  @IsOptional() @IsBoolean()
  responder?: boolean;

  @IsOptional() @IsBoolean()
  terminar?: boolean;
}

export class SubmitSurveyResponseDto {
  @IsOptional() @IsString() @MaxLength(100)
  respondentId?: string;

  /** Respuesta por id de pregunta. Se valida contra las preguntas reales en el controlador. */
  @IsObject()
  answers: Record<string, string | number>;
}
