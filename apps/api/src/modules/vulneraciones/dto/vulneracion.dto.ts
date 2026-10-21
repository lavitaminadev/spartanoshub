import { ArrayMaxSize, IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CrearVulneracionDto {
  @IsString() @MinLength(5) @MaxLength(5000) descripcion: string;
  @IsDateString() detectedAt: string;
  @IsString() @MinLength(2) @MaxLength(2000) datosAfectados: string;
  @IsOptional() @IsInt() @Min(0) titularesAfectados?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) clientIds?: string[];
  @IsOptional() @IsString() @MaxLength(5000) medidas?: string;
  @IsOptional() @IsDateString() avisoLocalAt?: string;
  @IsOptional() @IsDateString() avisoAgenciaAt?: string;
}

export class ActualizarVulneracionDto {
  @IsOptional() @IsString() @MinLength(5) @MaxLength(5000) descripcion?: string;
  @IsOptional() @IsDateString() detectedAt?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(2000) datosAfectados?: string;
  @IsOptional() @IsInt() @Min(0) titularesAfectados?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) clientIds?: string[];
  @IsOptional() @IsString() @MaxLength(5000) medidas?: string;
  @IsOptional() @IsDateString() avisoLocalAt?: string;
  @IsOptional() @IsDateString() avisoAgenciaAt?: string;
}
