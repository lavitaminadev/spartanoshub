import {
  IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength,
  ValidateIf,
} from 'class-validator';
import type { CampaignStatus } from '../campaign.entity';

/** Alta y edición de una campaña. */
export class SaveCampaignDto {
  /**
   * Debe escribirse igual que en `leads.campaign_name`.
   *
   * De ese nombre depende que el costo por lead cuente algo: si no coincide, la campaña aparece
   * con cero leads y una inversión que no se reparte entre nadie.
   */
  @IsString() @MinLength(2) @MaxLength(180) name: string;

  @IsOptional() @IsString() @MaxLength(50) source?: string;

  /** Cuenta a la que pertenece. `null` la deja como campaña de la propia agencia. */
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsUUID() clientId?: string | null;

  @IsOptional() @ValidateIf((_, value) => value !== null) @IsDateString() startsAt?: string | null;
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsDateString() endsAt?: string | null;

  /** Tope alto pero finito: evita que un error de tecleo entre como inversión de billones. */
  @IsOptional() @IsNumber() @Min(0) @Max(999999999999) investment?: number;

  @IsOptional() @IsIn(['active', 'paused', 'finished']) status?: CampaignStatus;

  /**
   * Pixel propio de esta campaña. `null` la devuelve a heredar el de su empresa.
   *
   * Solo hace falta cuando una empresa anuncia varias marcas con cuentas publicitarias
   * distintas. Omitirlo no toca lo que ya estuviera configurado.
   */
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsString() @MaxLength(40)
  metaPixelId?: string | null;
}
