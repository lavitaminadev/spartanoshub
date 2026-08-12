import { IsString, MaxLength, MinLength } from 'class-validator';

/** Cuerpo para publicar una versión nueva del consentimiento informado. */
export class PublishConsentVersionDto {
  @IsString() @MinLength(3) @MaxLength(200)
  title: string;

  /**
   * Texto íntegro que la persona acepta.
   *
   * Se guarda completo y no una referencia: ante una consulta del titular hay que poder
   * mostrar lo que aceptó, no lo que el documento dice hoy.
   */
  @IsString() @MinLength(10)
  text: string;
}
