import { IsBoolean, IsEmail, IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { UserRole } from '../../organizations/user-role.enum';
import { PERFILES_CRM } from '../../crm/leads/lead-visibility';

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255) name?: string;

  @IsOptional() @IsEmail() email?: string;

  @IsOptional() @IsString() @MaxLength(20) phone?: string;

  @IsOptional() @IsEnum(UserRole) role?: UserRole;

  @IsOptional() @IsUUID() clientId?: string | null;

  /**
   * Forma de usar el CRM: `principal` abarca su empresa entera, `venta` solo lo suyo.
   *
   * Cadena vacía o `null` devuelve la decisión al cargo, que es el estado natural de quien
   * trabaja en la agencia. Es independiente del rol: el rol dice a qué módulos entra.
   */
  @IsOptional() @ValidateIf((_, value) => value !== null && value !== '')
  @IsIn([...PERFILES_CRM]) crmProfile?: string | null;

  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional() @IsString() @MinLength(8) @MaxLength(128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/, { message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número' }) password?: string;

  @IsOptional() @IsIn(['presential', 'hybrid', 'remote']) workMode?: 'presential' | 'hybrid' | 'remote';

  @IsOptional() @IsNumber() @Min(1) @Max(1000) weeklyCapacityUd?: number;
}
