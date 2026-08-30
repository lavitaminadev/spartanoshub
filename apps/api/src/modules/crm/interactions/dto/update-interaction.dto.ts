import { IsOptional, IsString, IsDateString, IsUUID, MaxLength } from 'class-validator';

export class UpdateInteractionDto {
  @IsOptional() @IsString() @MaxLength(50) type?: string;
  @IsOptional() @IsUUID() leadId?: string | null;
  @IsOptional() @IsUUID() contactId?: string | null;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsDateString() date?: string;
  /** Por dónde ocurre. Solo tiene sentido en reuniones y visitas. */
  @IsOptional() @IsString() @MaxLength(40) medium?: string;

  /** El enlace o la dirección, según el medio. */
  @IsOptional() @IsString() @MaxLength(500) location?: string;
}
