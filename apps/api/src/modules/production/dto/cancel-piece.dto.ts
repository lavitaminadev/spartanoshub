import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { CancelOrigin } from '../cancel-origin.enum';

export class CancelPieceDto {
  /** Por qué no se va a hacer. Queda en la pieza y en el movimiento de devolución. */
  @IsString() @MinLength(3) @MaxLength(500) reason: string;

  /**
   * De quién fue la decisión. Es obligatorio a propósito: sin esto el mes muestra trabajo
   * perdido sin decir si hubo que bajarlo porque el cliente cambió o porque la agencia erró.
   */
  @IsEnum(CancelOrigin) origin: CancelOrigin;
}
