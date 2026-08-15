import { IsString, IsOptional, IsUUID, IsInt, Min, Max, MaxLength, IsEnum, IsDateString, IsArray } from 'class-validator';
import { PieceType } from '../piece-type.enum';

export class CreatePieceDto {
  @IsUUID() clientId: string;
  @IsString() @MaxLength(255) title: string;
  /** Clave del tipo en el catalogo de la organizacion. Se valida contra los tipos activos, no
   * contra el enum: un tipo aprobado despues de compilar tambien debe poder pedirse. */
  @IsString() @MaxLength(50) type: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) difficultyLevel?: number;
  @IsOptional() @IsInt() @Min(2) @Max(20) carouselSlides?: number;
  @IsOptional() @IsDateString() deadlineAt?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) dependencyIds?: string[];
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
