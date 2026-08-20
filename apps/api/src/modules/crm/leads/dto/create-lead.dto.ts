import { IsString, IsOptional, IsEmail, MaxLength, MinLength, Matches, IsNumber, Min, Max } from 'class-validator';

export class CreateLeadDto {
  @IsString() @MinLength(2) @MaxLength(255) name: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(50) source?: string;
  @IsOptional() @IsString() @MaxLength(255) company?: string;
  @IsOptional() @Matches(/^[\d+\-\s()]+$/, { message: 'Invalid phone format' }) @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;

  /**
   * Monto estimado del negocio.
   *
   * Sin este campo la columna existía y nadie podía escribirla, así que las cifras de dinero del
   * panel quedaban en cero para siempre sin que nada fallara.
   */
  @IsOptional() @IsNumber() @Min(0) @Max(999999999999) estimatedAmount?: number;
}
