import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PieceTypeArea } from '../piece-type-definition.entity';

export class CreatePieceTypeDto {
  @IsString() @MinLength(2) @MaxLength(100) label: string;

  /** Identificador estable. Si no viene, se deriva del nombre. */
  @IsOptional() @IsString() @MaxLength(50) key?: string;

  @IsOptional() @IsEnum(PieceTypeArea) area?: PieceTypeArea;

  /** Unidades sugeridas. Quien aprueba puede corregirlas antes de activar el tipo. */
  @IsOptional() @IsNumber() @Min(0) @Max(100) udAmount?: number;

  /** Extra por cada elemento adicional, para tipos que se cobran por tramos. */
  @IsOptional() @IsNumber() @Min(0) @Max(100) extraPerUnit?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(10) xpWeight?: number;
  @IsOptional() @IsBoolean() isPrint?: boolean;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdatePieceTypeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) label?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) udAmount?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) extraPerUnit?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10) xpWeight?: number;
  @IsOptional() @IsBoolean() isPrint?: boolean;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
