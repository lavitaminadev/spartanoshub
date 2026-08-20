import { IsArray, IsEnum, IsOptional, IsString, MaxLength, IsNumber, Min, Max, IsUUID, ValidateIf } from 'class-validator';
import { LeadStatus } from '../lead-status.enum';
import { LeadFitStatus } from '../lead-fit-status.enum';

export class UpdateLeadDto {
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @IsOptional() @IsEnum(LeadFitStatus) fitStatus?: LeadFitStatus;
  @IsOptional() @IsString() @MaxLength(2000) discardReason?: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;

  /**
   * Monto estimado del negocio.
   *
   * Sin este campo la columna existía y nadie podía escribirla, así que las cifras de dinero del
   * panel quedaban en cero para siempre sin que nada fallara.
   */
  @IsOptional() @IsNumber() @Min(0) @Max(999999999999) estimatedAmount?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];

  /**
   * Persona responsable del lead.
   *
   * La columna `assigned_to` existía desde el principio y no había forma de escribirla: los
   * leads llegaban sin dueño y la ficha solo podía mostrar «Sin asignar» para siempre.
   *
   * `null` es un valor válido y distinto de omitir el campo: significa devolverlo a la bandeja
   * común. Sin poder desasignar, un lead que cambia de manos queda con el dueño anterior.
   */
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsUUID() assignedTo?: string | null;
}
