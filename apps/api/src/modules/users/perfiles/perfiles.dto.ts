import { IsBoolean, IsEmail, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class PerfilDto {
  @IsString() @MinLength(2) @MaxLength(80) nombre: string;

  @IsOptional() @IsString() @MaxLength(300) descripcion?: string;

  /** Clave de área → nivel. El contenido lo valida el catálogo, no el decorador. */
  @IsObject() areas: Record<string, string>;

  @IsOptional() @IsObject() datosProtegidos?: Record<string, string>;

  /** Id del texto de confidencialidad aceptado. */
  @IsOptional() @IsUUID() aceptacion?: string;

  /** Cuántas personas dijo la pantalla que cambian. */
  @IsOptional() @IsInt() @Min(0) confirmaPersonas?: number;
}

export class AsignarPerfilDto {
  /** `null` le quita el perfil. */
  @IsOptional() @IsUUID() perfilId?: string | null;
}

export class InvitarDto {
  @IsEmail() email: string;

  /** El perfil se elige al invitar: entre invitar y configurar el acceso quedaría indefinido. */
  @IsUUID() perfilId: string;

  /** Quien administra confirma, a sabiendas, que una persona vetada puede volver. */
  @IsOptional() @IsBoolean() confirmaVeto?: boolean;

  /** Obligatorio si esa persona ya estuvo en este equipo: meses después, un reingreso sin motivo parece un error. */
  @IsOptional() @IsString() @MaxLength(300) motivoReingreso?: string;
}

export class AceptarInvitacionDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;

  @IsOptional() @IsString() @MaxLength(128) password?: string;
}
