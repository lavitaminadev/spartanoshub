import { IsArray, IsEnum, IsOptional, IsString, MaxLength, IsNumber, Min, Max, IsUUID, ValidateIf } from 'class-validator';
import { LeadStatus } from '../lead-status.enum';
import { LeadFitStatus } from '../lead-fit-status.enum';

export class UpdateLeadDto {
  /**
   * Identidad y contacto del lead.
   *
   * Se podían escribir al crear y al importar, y no corregir después: un nombre mal escrito o un
   * teléfono con un dígito de más quedaban así para siempre, y ese teléfono es justamente el
   * único camino para llamar. Cadena vacía borra el dato, que es distinto de omitir el campo.
   */
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  // Sin `@IsEmail`: entran leads con el correo mal escrito y esta es la pantalla donde se
  // arregla. Rechazarlo aquí obligaría a corregir en la base justo el caso que hay que corregir.
  @IsOptional() @IsString() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(255) company?: string;

  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @IsOptional() @IsEnum(LeadFitStatus) fitStatus?: LeadFitStatus;
  @IsOptional() @IsString() @MaxLength(2000) discardReason?: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;

  /**
   * Monto estimado del negocio.
   *
   * Sin este campo la columna existía y nadie podía escribirla, así que las cifras de dinero del
   * panel quedaban en cero para siempre sin que nada fallara.
   */
  @IsOptional() @IsNumber() @Min(0) @Max(999999999999) estimatedAmount?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];

  /**
   * Persona responsable del lead.
   *
   * La columna `assigned_to` existía desde el principio y no había forma de escribirla: los
   * leads llegaban sin dueño y la ficha solo podía mostrar «Sin asignar» para siempre.
   *
   * `null` es un valor válido y distinto de omitir el campo: significa devolverlo a la bandeja
   * común. Sin poder desasignar, un lead que cambia de manos queda con el dueño anterior.
   */
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsUUID() assignedTo?: string | null;

  /**
   * Origen del lead.
   *
   * Se podía fijar al crearlo y al importarlo, pero no corregir después. Un lead que entró con
   * el origen equivocado —o sin origen, por un formulario que no lo mandaba— quedaba así para
   * siempre, y el informe por fuente arrastraba ese error sin forma de enmendarlo.
   */
  @IsOptional() @IsString() @MaxLength(50) source?: string;

  /**
   * Cuenta a la que pertenece.
   *
   * Permite mover un contacto de campaña que entró a la cuenta equivocada, que hasta ahora
   * había que corregir en la base. `null` lo deja sin cuenta, que es el estado natural de un
   * prospecto del embudo de la agencia.
   *
   * El controlador comprueba que quien edita alcance la cuenta de destino: sin eso, cambiar
   * este campo sería una forma de mover datos a una cuenta ajena.
   */
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsUUID() clientId?: string | null;
}
