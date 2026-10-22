import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

export class ListOpportunitiesDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  leadId?: string;

  /**
   * Empresa cuyo embudo se está mirando.
   *
   * Sin ella la lista abarca todas las que la cuenta alcanza, y la pantalla las enseñaba
   * mezcladas bajo el encabezado de una sola. Se comprueba contra el alcance antes de usarse.
   */
  @IsOptional()
  @IsUUID()
  clientId?: string;
}
