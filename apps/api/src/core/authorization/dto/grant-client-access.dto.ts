import { IsOptional, IsString, MaxLength, IsISO8601 } from 'class-validator';

export class GrantClientAccessDto {
  /**
   * Por qué esta persona necesita esta cuenta estando fuera de su pod.
   *
   * Opcional para no frenar una urgencia, pero se pide en la interfaz: una excepción sin
   * motivo es la que nadie se atreve a quitar después, porque ya nadie recuerda para qué era.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  /**
   * Fecha y hora en que deja de regir, en ISO 8601, y debe ser futura.
   *
   * Omitirla o enviarla nula lo deja sin fecha de término. Es válido, pero es una decisión de quien
   * lo concede y no el valor por defecto: al vencer, deja de contar sin que nadie tenga que retirarlo.
   */
  @IsOptional() @IsISO8601()
  expiresAt?: string | null;
}
