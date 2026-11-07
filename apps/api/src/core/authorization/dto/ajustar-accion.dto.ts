import { IsBoolean, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Abrir (`true`) o cerrar (`false`) una acción para una persona. */
export class AjustarAccionDto {
  @IsBoolean() allowed: boolean;

  /**
   * Empresa en la que rige. Omitida: en todas las que esa persona alcanza.
   *
   * No tiene valor por omisión a propósito. Quien concede ve el selector de empresa en la
   * pantalla y lo que elija viaja acá; omitirla es decir «en todas», que es una decisión distinta
   * y no el descuido de no haber elegido.
   */
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;

  /**
   * Fecha y hora en que deja de regir, en ISO 8601, y debe ser futura.
   *
   * Omitirla o enviarla nula lo deja sin fecha de término. Es válido, pero es una decisión de quien
   * lo concede y no el valor por defecto: al vencer, deja de contar sin que nadie tenga que retirarlo.
   */
  @IsOptional() @IsISO8601()
  expiresAt?: string | null;
}
