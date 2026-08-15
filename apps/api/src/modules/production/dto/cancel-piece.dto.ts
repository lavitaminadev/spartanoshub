import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelPieceDto {
  /** Por qué no se va a hacer. Queda en el movimiento de devolución, que es donde se revisa el mes. */
  @IsString() @MinLength(3) @MaxLength(255) reason: string;
}
