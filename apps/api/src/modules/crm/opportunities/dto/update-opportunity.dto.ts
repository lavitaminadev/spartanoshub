import { IsObject, IsOptional, IsString, IsNumber, IsDateString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class UpdateOpportunityDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsUUID() leadId?: string | null;
  @IsOptional() @IsUUID() clientId?: string | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) amount?: number;
  @IsOptional() @IsString() @MaxLength(50) stage?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) probability?: number;
  @IsOptional() @IsDateString() expectedCloseDate?: string;
  @IsOptional() @IsString() @MaxLength(500) nextAction?: string | null;
  @IsOptional() @IsDateString() nextActionAt?: string | null;
  @IsOptional() @IsUUID() assignedTo?: string;
  @IsOptional() @IsString() @MaxLength(60) lossReason?: string;
  @IsOptional() @IsString() @MaxLength(2000) lossNote?: string;
  /** Campos propios de oportunidades, por clave. El caso de uso los valida contra sus definiciones. */
  @IsOptional() @IsObject() customFields?: Record<string, unknown>;
}
