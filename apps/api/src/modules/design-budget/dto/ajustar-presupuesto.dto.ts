import { IsUUID, IsInt, Min, Max, IsNumber, IsString, MinLength, MaxLength } from 'class-validator';

/** Cambia cuántas UD tiene contratadas una empresa en un mes concreto. */
export class AjustarPresupuestoDto {
  @IsUUID() clientId: string;
  @IsInt() @Min(2024) year: number;
  @IsInt() @Min(1) @Max(12) month: number;
  /** El nuevo total del mes, no la diferencia: dos ajustes seguidos no se suman por error. */
  @IsNumber() @Min(0) @Max(9999) contratadas: number;
  /**
   * Por qué cambió.
   *
   * Obligatorio y con largo mínimo: un ajuste sin explicación es indistinguible de un error de
   * tecleo cuando alguien lo revisa tres meses después, y es lo primero que se pregunta.
   */
  @IsString() @MinLength(5) @MaxLength(255) motivo: string;
}
