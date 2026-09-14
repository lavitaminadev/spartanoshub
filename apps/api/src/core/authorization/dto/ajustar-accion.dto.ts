import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Abrir (`true`) o cerrar (`false`) una acción para una persona. */
export class AjustarAccionDto {
  @IsBoolean() allowed: boolean;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
