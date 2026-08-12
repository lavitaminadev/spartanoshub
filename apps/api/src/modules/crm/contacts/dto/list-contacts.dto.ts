import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';

/**
 * Filtros del listado de contactos.
 *
 * `clientId` se declara junto a la paginación y no se lee con un `@Query('clientId')` aparte
 * porque la validación global corre con `forbidNonWhitelisted`: al validar el objeto completo
 * contra un DTO que solo conocía `limit` y `offset`, filtrar por cuenta devolvía 400.
 */
export class ListContactsDto extends PaginationDto {
  @IsOptional() @IsUUID()
  clientId?: string;
}
