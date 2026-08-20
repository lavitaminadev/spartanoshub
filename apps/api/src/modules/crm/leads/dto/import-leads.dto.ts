import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsISO8601, IsOptional, IsString,
  Matches, MaxLength, MinLength, ValidateNested,
} from 'class-validator';

/** Una fila del archivo, ya mapeada a los campos del prospecto. */
export class ImportLeadRowDto {
  @IsString() @MinLength(2) @MaxLength(255) name: string;

  @IsOptional() @IsEmail() @MaxLength(255) email?: string;

  @IsOptional() @Matches(/^[\d+\-\s()]+$/, { message: 'El teléfono solo admite números, espacios, paréntesis, + y -' })
  @MaxLength(50) phone?: string;

  @IsOptional() @IsString() @MaxLength(255) company?: string;
  @IsOptional() @IsString() @MaxLength(255) notes?: string;

  /**
   * Origen de esta fila.
   *
   * Antes se fijaba igual para todo el archivo, así que una planilla mixta —parte pagada, parte
   * orgánica— entraba marcada toda igual y el costo por lead quedaba repartido entre campañas que
   * no la trajeron. Sin valor en la fila, se usa el del archivo.
   */
  @IsOptional() @IsString() @MaxLength(50) source?: string;

  /** Canal por el que llegó: correo, WhatsApp, teléfono, presencial. */
  @IsOptional() @IsString() @MaxLength(255) sourceDetail?: string;

  /** Campaña o formulario que lo trajo. Es lo que alimenta el costo por lead. */
  @IsOptional() @IsString() @MaxLength(180) campaignName?: string;

  /** Teléfono alternativo, para no pisar el principal cuando el archivo trae los dos. */
  @IsOptional() @IsString() @MaxLength(50) altPhone?: string;

  /** Etiquetas de la celda, separadas por coma o punto y coma. */
  @IsOptional() @IsString() @MaxLength(500) tags?: string;

  /**
   * Cuándo ocurrió en el origen, en ISO.
   *
   * Sin esto, importar trescientas filas las mete todas como del día de la importación y el
   * gráfico por día muestra un pico que nunca existió.
   */
  @IsOptional() @IsISO8601() sourceCreatedAt?: string;
}

/**
 * Importación de prospectos desde un archivo.
 *
 * El tope de filas no es decorativo. Cada una atraviesa la deduplicación completa, que consulta
 * por correo, teléfono e identificador externo; un archivo de miles de filas mantendría la
 * petición abierta varios minutos y, con 768 MB compartidos, afectaría a todo lo demás. Si hace
 * falta más, se sube en tandas.
 */
export class ImportLeadsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => ImportLeadRowDto)
  rows: ImportLeadRowDto[];

  /**
   * Origen con el que quedan marcados los prospectos importados.
   *
   * Se exige en vez de inventarlo para que después se pueda distinguir en los informes lo que
   * entró por un archivo de lo que llegó por una campaña.
   */
  @IsString() @MinLength(2) @MaxLength(50) source: string;

  @IsOptional() @IsString() @MaxLength(255) sourceDetail?: string;
}
