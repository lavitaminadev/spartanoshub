import { IsString, IsOptional, IsEmail, MaxLength, MinLength, Matches, IsNumber, Min, Max, IsUUID, IsIn } from 'class-validator';

export class CreateLeadDto {
  @IsString() @MinLength(2) @MaxLength(255) name: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(50) source?: string;
  @IsOptional() @IsString() @MaxLength(255) company?: string;
  @IsOptional() @Matches(/^[\d+\-\s()]+$/, { message: 'Invalid phone format' }) @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(10000) notes?: string;

  /**
   * Monto estimado del negocio.
   *
   * Sin este campo la columna existía y nadie podía escribirla, así que las cifras de dinero del
   * panel quedaban en cero para siempre sin que nada fallara.
   */
  @IsOptional() @IsNumber() @Min(0) @Max(999999999999) estimatedAmount?: number;
  @IsOptional() @IsIn(['green', 'yellow', 'red']) trafficLight?: 'green' | 'yellow' | 'red';

  /**
   * Empresa a la que pertenece el contacto.
   *
   * Faltaba, y el efecto era silencioso: crear un contacto desde el CRM de una empresa lo
   * guardaba **sin empresa y en el embudo comercial de la agencia**, mezclado con los
   * prospectos propios. No fallaba nada; simplemente el contacto no aparecía donde se había
   * creado y sí donde no correspondía.
   *
   * El controlador comprueba que quien crea alcance esa empresa y que tenga CRM contratado.
   */
  @IsOptional() @IsUUID() clientId?: string;

  /**
   * Embudo al que entra. Por defecto el comercial, que preserva lo que hacía antes.
   *
   * Un contacto de campaña recorre el ciclo de una visita y un prospecto de la agencia el de una
   * venta: nacer en el equivocado deja al lead sin columna donde dibujarse.
   */
  @IsOptional() @IsIn(['audience', 'commercial']) domain?: 'audience' | 'commercial';
}
