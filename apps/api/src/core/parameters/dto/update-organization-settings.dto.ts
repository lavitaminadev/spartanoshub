import { IsNotEmptyObject, IsObject, IsOptional, IsUUID } from 'class-validator';

export class UpdateOrganizationSettingsDto {
  @IsObject()
  @IsNotEmptyObject()
  values: Record<string, unknown>;
  /**
   * Reserva que se aparta del texto de su empresa.
   *
   * Ausente guarda en la empresa, o en la organización si tampoco hay empresa: es el
   * comportamiento de siempre. Lo que la reserva no escriba sigue heredando.
   */
  @IsOptional() @IsUUID() formId?: string;
}
