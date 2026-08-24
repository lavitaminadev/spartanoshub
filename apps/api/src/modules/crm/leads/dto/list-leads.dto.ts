import { IsOptional, IsString, IsEnum, IsUUID, IsIn, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';
import { LeadStatus } from '../lead-status.enum';
import { LeadFitStatus } from '../lead-fit-status.enum';

export class ListLeadsQueryDto extends PaginationDto {
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @IsOptional() @IsEnum(LeadFitStatus) fitStatus?: LeadFitStatus;
  @IsOptional() @IsString() source?: string;
  /** Búsqueda real sobre toda la cuenta; no solo sobre la página que ya cargó el navegador. */
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsUUID() assignedTo?: string;
  @IsOptional() @IsUUID() clientId?: string;
  /** Sin este parámetro, el listado asume 'commercial' — ver ListLeadsFilters.domain. */
  @IsOptional() @IsIn(['audience', 'commercial', 'all']) domain?: 'audience' | 'commercial' | 'all';
}
