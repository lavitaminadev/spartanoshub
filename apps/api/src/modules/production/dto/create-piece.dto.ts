import { IsString, IsOptional, IsUUID, IsInt, Min, Max, MaxLength, IsDateString, IsArray } from 'class-validator';

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
  /**
   * El brief que origina esta pieza.
   *
   * Opcional porque una pieza puede nacer sin él. Cuando viene, el servidor comprueba que sea de
   * la misma empresa y copia título y descripción si no se escribieron: hasta ahora alguien
   * escribía el brief y otra persona lo volvía a teclear al crear la pieza.
   */
  @IsOptional() @IsUUID() briefId?: string;
}
