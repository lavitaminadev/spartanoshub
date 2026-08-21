import { IsEmail, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Lead que entra por integración.
 *
 * Quien arma el mapeo en Zapier no lee este archivo: mapea a mano, prueba, y ve el error en una
 * pantalla. Por eso el contrato es deliberadamente tolerante en la entrada y estricto en el
 * mensaje de salida.
 *
 * **No trae la fuente.** La determina la llave con que se llamó, de modo que nadie pueda
 * declararse «Meta Ads» desde un portal cualquiera.
 *
 * Los nombres alternativos —`full_name`, `phone_number`, `created_time`— los resuelve
 * `normalizarCuerpoEntrada` antes de llegar acá. Se intentó con `@Transform` y no sirve: un
 * transformador de `class-transformer` solo se ejecuta si la propiedad de destino **ya viene**
 * en el cuerpo, así que un lead de Meta nunca disparaba el de `nombre` y la respuesta decía
 * «Falta el nombre» sobre un cuerpo que sí lo traía.
 */
export class IngestLeadDto {
  /**
   * Nombre de la persona.
   *
   * Acepta `nombre`, `name` y `full_name` porque son los tres que produce cualquier formulario
   * en español o inglés, y equivocarse cuesta una ronda de prueba y error en Zapier.
   */
  @IsString({ message: 'Falta el nombre. Mapea el campo `nombre` (o `name`) en tu Zap.' })
  @MaxLength(180)
  nombre: string;

  @IsOptional() @IsString() @MaxLength(50)
  telefono?: string;

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
  @IsOptional() @IsString() @MaxLength(120)
  idExterno?: string;

  @IsOptional() @IsString() @MaxLength(180)
  campana?: string;

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
  @IsOptional() @IsISO8601()
  fechaOrigen?: string;

  /**
   * Atribución del anuncio: formulario, campaña, anuncio y página que produjeron el lead.
   *
   * Son las mismas cuatro columnas que llena el webhook firmado de Meta. Aceptarlas por el
   * puente hace que un lead se vea igual sin importar por cuál de los dos caminos entró, que es
   * lo que permite cambiar de uno a otro sin un corte en los informes.
   *
   * Opcionales todas: sin ellas el lead entra igual, solo que sin saber qué anuncio lo trajo.
   */
  @IsOptional() @IsString() @MaxLength(255) formId?: string;
  @IsOptional() @IsString() @MaxLength(255) campanaId?: string;
  @IsOptional() @IsString() @MaxLength(255) anuncioId?: string;
  @IsOptional() @IsString() @MaxLength(255) paginaId?: string;
}
