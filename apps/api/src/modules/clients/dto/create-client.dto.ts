import { IsString, IsOptional, IsUUID, IsNumber, IsInt, MaxLength, MinLength, Min, Max, Matches, IsBoolean, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { CLIENT_INDUSTRY_VALUES } from '@espartanos/shared';

export class ClientCapabilitiesDto {
  @IsOptional() @IsBoolean() reservations?: boolean;
  @IsOptional() @IsBoolean() crm?: boolean;
  @IsOptional() @IsBoolean() metaConversions?: boolean;
}

export class CreateClientDto {
  @IsString() @MinLength(2) @MaxLength(255) name: string;
  @IsOptional() @IsString() @MaxLength(255) legalName?: string;
  /**
   * Rubro del cliente, de la lista cerrada.
   *
   * Deja de ser texto libre porque se usa para agrupar en reportes: escrito a mano,
   * «gastronómico», «Gastronomia» y «restaurante» son tres rubros distintos y ningún informe
   * por rubro cuadra. La lista incluye `otro` para que nadie tenga que forzar una categoría.
   */
  @IsOptional() @IsIn(CLIENT_INDUSTRY_VALUES as string[]) industry?: string;
  @IsOptional() @IsUUID() communityManagerId?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsNumber() @Min(0) retainerAmount?: number;
  @IsOptional() @IsString() @Matches(/^[A-Za-z]{3}$/) currency?: string;
  @IsOptional() @IsNumber() @Min(0) defaultUdBudget?: number;
  /** Máximo de reservas por día sumando todos los formularios del cliente. 0 = sin límite. */
  @IsOptional() @IsInt() @Min(0) @Max(5000) dailyReservationCap?: number;
  @IsOptional() @ValidateNested() @Type(() => ClientCapabilitiesDto) capabilities?: ClientCapabilitiesDto;
}
