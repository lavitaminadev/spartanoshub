import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { QuoteStatus } from '../quote-status.enum';

export class ListQuotesQueryDto extends PaginationDto {
  /** Fragmento del nombre de la empresa; no distingue mayúsculas ni acentos. */
  @IsOptional() @IsString() @MaxLength(120) empresa?: string;
  @IsOptional() @IsEnum(QuoteStatus) status?: QuoteStatus;
  /** Rango de creación, `AAAA-MM-DD`; `hasta` incluye el día entero. */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) desde?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) hasta?: string;
}
