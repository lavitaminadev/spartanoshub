import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Confirmación de contraseña para operaciones críticas.
 *
 * No pide el correo: la sesión ya dice quién es. Pedirlo abriría un camino para confirmar
 * contraseñas de otras cuentas desde una sesión cualquiera.
 */
export class ReauthenticateDto {
  @IsString() @MinLength(1) @MaxLength(200) password: string;
}
