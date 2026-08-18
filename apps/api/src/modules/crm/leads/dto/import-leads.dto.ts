import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsOptional, IsString,
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
