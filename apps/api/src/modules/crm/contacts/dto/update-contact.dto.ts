import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Lo único editable de un vínculo: el papel de la persona en la cuenta y las notas.
 *
 * Nombre, correo y teléfono **no** están acá a propósito. La identidad vive en el lead y se
 * edita ahí; tenerla también en este DTO era lo que permitía que los dos registros dijeran
 * cosas distintas de la misma persona, sin que nada avisara cuál de las dos era la cierta.
 *
 * `leadId` tampoco: mover un vínculo de una persona a otra no es una edición, es un cambio de
 * a quién pertenece el historial. Si hiciera falta, será una operación con nombre propio.
 */
export class UpdateContactDto {
  @IsOptional() @IsString() @MaxLength(255) position?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}
