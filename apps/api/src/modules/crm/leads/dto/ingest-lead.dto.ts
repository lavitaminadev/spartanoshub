import { IsEmail, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Lead que entra por integración.
 *
 * Quien arma el mapeo en Zapier no lee este archivo: mapea a mano, prueba, y ve el error en una
 * pantalla. Por eso el contrato es deliberadamente tolerante en la entrada y estricto en el
 * mensaje de salida.
 *
 * **No trae la fuente.** La determina la llave con que se llamó, de modo que nadie pueda
 * declararse «Meta Ads» desde un portal cualquiera.
 */

/** Toma el primer nombre de campo presente, para no obligar a acertar el exacto. */
function primeroDe(...alternativas: unknown[]): string | undefined {
  for (const valor of alternativas) {
    if (typeof valor === 'string' && valor.trim()) return valor.trim();
    if (typeof valor === 'number') return String(valor);
  }
  return undefined;
}

export class IngestLeadDto {
  /**
   * Nombre de la persona.
   *
   * Acepta `nombre`, `name` y `full_name` porque son los tres que produce cualquier formulario
   * en español o inglés, y equivocarse cuesta una ronda de prueba y error en Zapier.
   */
  @Transform(({ obj }) => primeroDe(obj.nombre, obj.name, obj.full_name, obj.fullName))
  @IsString({ message: 'Falta el nombre. Mapea el campo `nombre` (o `name`) en tu Zap.' })
  @MaxLength(180)
  nombre: string;

  @Transform(({ obj }) => primeroDe(obj.telefono, obj.phone, obj.celular, obj.mobile, obj.phone_number))
  @IsOptional() @IsString() @MaxLength(50)
  telefono?: string;

  @Transform(({ obj }) => primeroDe(obj.email, obj.correo, obj.mail)?.toLowerCase())
  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene forma de correo. Revisa el campo que mapeaste.' })
  @MaxLength(180)
  email?: string;

  /**
   * Identificador del lead en el sistema de origen.
   *
   * **Es lo que evita duplicados**, y con Zapier no es opcional en la práctica: Zapier reintenta
   * ante cualquier error de servidor, así que sin esta clave un corte de red convierte un lead en
   * tres. Cuando no viene, se deduce del teléfono o el correo.
   */
  @Transform(({ obj }) => primeroDe(obj.idExterno, obj.external_id, obj.externalId, obj.id))
  @IsOptional() @IsString() @MaxLength(120)
  idExterno?: string;

  @Transform(({ obj }) => primeroDe(obj.campana, obj.campaign, obj.utm_campaign))
  @IsOptional() @IsString() @MaxLength(180)
  campana?: string;

  @Transform(({ obj }) => primeroDe(obj.mensaje, obj.message, obj.notas, obj.notes, obj.comentario))
  @IsOptional() @IsString() @MaxLength(2000)
  mensaje?: string;

  /**
   * Cuándo ocurrió en el origen, en formato ISO.
   *
   * Sin esto todo lead entra con la hora en que el sistema lo recibió, y una integración que se
   * atasca dos horas pasa inadvertida porque sus leads siguen pareciendo puntuales. Con la fecha
   * de origen, la brecha entre ambas queda a la vista.
   *
   * Quien no la mande sigue funcionando: se deja vacía, que es distinto de suponerla.
   */
  @Transform(({ obj }) => primeroDe(obj.fechaOrigen, obj.created_time, obj.createdTime, obj.created_at, obj.fecha))
  @IsOptional() @IsISO8601()
  fechaOrigen?: string;
}
