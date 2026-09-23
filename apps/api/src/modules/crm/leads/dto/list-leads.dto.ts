import { IsBoolean, IsOptional, IsString, IsEnum, IsUUID, IsIn, Matches, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../../shared/dto/pagination.dto';
import { LeadStatus } from '../lead-status.enum';
import { LeadFitStatus } from '../lead-fit-status.enum';

export class ListLeadsQueryDto extends PaginationDto {
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @IsOptional() @IsEnum(LeadFitStatus) fitStatus?: LeadFitStatus;
  @IsOptional() @IsString() source?: string;
  /**
   * Campaña exacta por la que se acota.
   *
   * Distinto de `search`, que además de la campaña mira nombre, correo, teléfono, empresa y
   * origen: buscar «Verano» por texto devolvía también a quien se apellida así. Acá la
   * coincidencia es exacta, que es lo que permite leer «cuántos trajo esta campaña».
   */
  @IsOptional() @IsString() @MaxLength(255) campaignName?: string;
  /** Búsqueda real sobre toda la cuenta; no solo sobre la página que ya cargó el navegador. */
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  /**
   * Responsable por el que se filtra.
   *
   * `sin` trae los que no tiene nadie. Es un valor aparte y no la ausencia del filtro porque
   * son dos preguntas distintas: «todos» y «los que faltan por repartir».
   */
  @IsOptional() @ValidateIf((_objeto: unknown, valor: unknown) => valor !== 'sin') @IsUUID() assignedTo?: string;
  @IsOptional() @IsUUID() clientId?: string;
  /** Sin este parámetro, el listado asume 'commercial' — ver ListLeadsFilters.domain. */
  @IsOptional() @IsIn(['audience', 'commercial', 'all']) domain?: 'audience' | 'commercial' | 'all';
  /**
   * Traer los descartados de meses ya cerrados.
   *
   * Llega como texto en la consulta, así que se transforma antes de validar: sin esto,
   * `?incluirDescartados=false` sería la cadena 'false', que es verdadera.
   */
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean()
  incluirDescartados?: boolean;
  /**
   * Filtro por un campo propio: su clave y el valor buscado.
   *
   * La clave sigue la misma regla que al crear el campo, así nunca llega texto arbitrario a la
   * ruta JSON. El valor se compara exacto; en una selección múltiple basta con que lo contenga.
   */
  /**
   * Anuncio del que vino el lead, por su nombre. Compara por contenido: los nombres llevan
   * fecha y versión —«FRANQUICIAS-REEL2-MAY2026»— y casi siempre se busca la familia, no uno.
   */
  @IsOptional() @IsString() @MaxLength(180) anuncio?: string;

  /** Dónde vio el anuncio: `ig` o `fb`. Una misma campaña trae por los dos. */
  @IsOptional() @IsIn(['ig', 'fb']) plataforma?: string;

  @IsOptional() @Matches(/^[a-z][a-z0-9_]{0,39}$/) campoPropio?: string;
  @ValidateIf((objeto: { campoPropio?: string }) => Boolean(objeto.campoPropio)) @IsString() @MaxLength(255) valorPropio?: string;
}
