import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Una fila del archivo, ya mapeada a los campos del prospecto.
 *
 * Aquí solo se comprueba la **forma**: que cada campo conocido, si viene, sea texto. Las reglas
 * de contenido —formato del correo, forma del teléfono, largos, fecha de origen— viven en
 * `validateImportRow` y se aplican fila por fila dentro del caso de uso.
 *
 * El motivo es el contrato de la importación: una fila mala se informa y las demás entran. Si
 * el formato del correo se exigiera acá, la validación del cuerpo rechazaría la petición
 * completa y un archivo de trescientas filas no entraría por dos correos mal escritos.
 *
 * Lo que sí conserva esta clase es el filtrado de columnas desconocidas: al declararse los
 * campos, la validación descarta cualquier otra clave antes de que llegue al dominio.
 */
export class ImportLeadRowDto {
  @IsString() name: string;

  @IsOptional() @IsString() email?: string;

  @IsOptional() @IsString() phone?: string;

  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() notes?: string;

  /**
   * Origen de esta fila.
   *
   * Antes se fijaba igual para todo el archivo, así que una planilla mixta —parte pagada, parte
   * orgánica— entraba marcada toda igual y el costo por lead quedaba repartido entre campañas que
   * no la trajeron. Sin valor en la fila, se usa el del archivo.
   */
  @IsOptional() @IsString() source?: string;

  /** Canal por el que llegó: correo, WhatsApp, teléfono, presencial. */
  @IsOptional() @IsString() sourceDetail?: string;

  /** Campaña o formulario que lo trajo. Es lo que alimenta el costo por lead. */
  @IsOptional() @IsString() campaignName?: string;

  /** Teléfono alternativo, para no pisar el principal cuando el archivo trae los dos. */
  @IsOptional() @IsString() altPhone?: string;

  /** Etiquetas de la celda, separadas por coma o punto y coma. */
  @IsOptional() @IsString() tags?: string;

  /**
   * Cuándo ocurrió en el origen, en ISO.
   *
   * Sin esto, importar trescientas filas las mete todas como del día de la importación y el
   * gráfico por día muestra un pico que nunca existió.
   */
  @IsOptional() @IsString() sourceCreatedAt?: string;
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

  /**
   * Cuenta de la agencia a la que pertenecen estos prospectos.
   *
   * Sin este dato una importación de contactos de campaña entraba sin cuenta, y el equipo que
   * atiende a ese cliente no los veía: el listado se acota por las cuentas que cada persona
   * alcanza, y un lead sin cuenta no está en ninguna.
   *
   * Se comprueba contra las cuentas que quien importa puede ver, no solo contra la organización:
   * el identificador viaja desde el navegador y no puede ser la única palabra sobre a qué cuenta
   * se escribe.
   */
  @IsOptional() @IsUUID() clientId?: string;

  /**
   * A cuál de los dos embudos entra el archivo.
   *
   * `audience` son las personas que llegaron por las campañas de un cliente; `commercial` son
   * las empresas que la agencia quiere sumar como clientes. Los separa `leads.domain` desde la
   * migración 0069 y no son intercambiables: mezclarlos deja el embudo comercial de la agencia
   * lleno de contactos que nunca fueron prospectos suyos.
   *
   * Sin valor se mantiene `commercial`, que es lo que hacía la importación hasta ahora y lo que
   * espera quien ya la venía usando para cargar prospectos propios.
   */
  @IsOptional() @IsIn(['audience', 'commercial']) domain?: 'audience' | 'commercial';
}
