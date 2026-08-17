import { IsArray, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkRequestArea, WorkRequestStatus, WORK_REQUEST_PRIORITIES, type WorkRequestPriority } from '../work-request.entity';

export class CreateWorkRequestDto {
  @IsUUID() clientId: string;
  @IsEnum(WorkRequestArea) area: WorkRequestArea;
  @IsString() @MinLength(4) @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsEnum(WORK_REQUEST_PRIORITIES as unknown as object) priority?: WorkRequestPriority;
  @IsOptional() @IsDateString() neededBy?: string;

  /**
   * Campos que define cada área.
   *
   * Van sin esquema fijo a propósito: dirección creativa y operaciones los ajustan sin que eso
   * obligue a una migración. La validación de cuáles son obligatorios vive en el formulario,
   * porque es donde cambia.
   */
  @IsOptional() @IsObject() creativeFields?: Record<string, unknown>;
  @IsOptional() @IsObject() operationalFields?: Record<string, unknown>;
}

export class UpdateWorkRequestDto {
  @IsOptional() @IsEnum(WorkRequestStatus) status?: WorkRequestStatus;
  /** Cadena vacía desasigna; omitirlo deja el responsable como está. */
  @IsOptional() @IsString() assignedTo?: string;
  @IsOptional() @IsEnum(WORK_REQUEST_PRIORITIES as unknown as object) priority?: WorkRequestPriority;
  @IsOptional() @IsString() @MaxLength(500) rejectionReason?: string;
  @IsOptional() @IsObject() operationalFields?: Record<string, unknown>;
}

/**
 * Una pieza gráfica a crear al convertir. **Solo para el área de diseño.**
 *
 * Los campos son los mismos que pide crear una pieza a mano, para que una pieza nacida de una
 * solicitud sea indistinguible de una creada directamente: mismo tipo, misma dificultad y por lo
 * tanto el mismo cálculo de UD.
 */
export class ConvertPieceDto {
  @IsString() @MinLength(3) @MaxLength(200) title: string;
  /** Clave del tipo en el catalogo de la organizacion. Se valida contra los tipos activos, no
   * contra el enum: un tipo aprobado despues de compilar tambien debe poder pedirse. */
  @IsString() @MaxLength(50) type: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) difficultyLevel?: number;
  @IsOptional() @IsInt() @Min(2) @Max(20) carouselSlides?: number;
}

/**
 * La sesión de rodaje a agendar al convertir. **Solo para el área audiovisual.**
 *
 * Una sesión no es una pieza y no comparte nada con ella: no tiene tipo gráfico, no consume
 * unidades de dedicación, tiene fecha y locación, y se asigna a un equipo entero en vez de a una
 * persona. Los campos son los mismos que pide agendar una sesión a mano.
 */
export class ConvertSessionDto {
  @IsString() @Matches(/^[a-z0-9_-]{2,50}$/i) type: string;
  @IsDateString() date: string;
  @IsOptional() @IsString() @MaxLength(255) location?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsUUID(undefined, { each: true }) assignedTeam?: string[];
  @IsOptional() @IsUUID() moodboardId?: string;
}

/**
 * Cómo se resuelve una solicitud aceptada.
 *
 * Los dos campos son excluyentes y el área decide cuál corresponde; el servicio rechaza el que
 * no aplica en vez de ignorarlo en silencio. Un solo campo genérico habría hecho que convertir
 * una solicitud audiovisual creara una pieza gráfica sin que nadie lo notara.
 */
export class ResolveWorkRequestDto {
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ConvertPieceDto)
  pieces?: ConvertPieceDto[];

  @IsOptional() @ValidateNested() @Type(() => ConvertSessionDto)
  session?: ConvertSessionDto;
}
