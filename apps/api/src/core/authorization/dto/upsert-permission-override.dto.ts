import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { PERMISSION_LEVELS, PermissionLevel } from '../permission-level';

/** Cuerpo para crear o reemplazar la excepción de permiso de un usuario. */
export class UpsertPermissionOverrideDto {
  /** Nivel a conceder. `none` deniega de forma explícita lo que el cargo otorgaría. */
  @IsIn(PERMISSION_LEVELS as unknown as string[])
  level: PermissionLevel;

  /** Justificación de la excepción, para poder auditarla después. */
  @IsOptional() @IsString() @MaxLength(300)
  reason?: string;

  /**
   * Fecha y hora en que la excepción deja de aplicar, en ISO 8601.
   *
   * Omitirla o enviarla nula deja la excepción sin vencimiento. Al vencer, el nivel vuelve al
   * que define el cargo sin que nadie tenga que retirarla.
   */
  @IsOptional() @IsISO8601()
  expiresAt?: string | null;
}
