import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SERVICE_REQUEST_STATUSES, SERVICE_REQUEST_TYPES } from '../service-requests.service';

export class CreateServiceRequestDto {
  @IsString() @IsIn(SERVICE_REQUEST_TYPES) type: string;
  @IsString() @MinLength(2) @MaxLength(180) requesterName: string;
  @IsEmail() @MaxLength(190) requesterEmail: string;
  @IsOptional() @IsString() @MaxLength(20) requesterRut?: string;
  @IsOptional() @IsString() @MaxLength(50) requesterPhone?: string;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
  /** Aceptación del aviso de privacidad, requerida y guardada para la trazabilidad. */
  @IsBoolean() privacyAccepted: boolean;
  /** Honeypot anti-spam: un robot rellena este campo y la solicitud se descarta. */
  @IsOptional() @IsString() website?: string;
}

export class UpdateServiceRequestDto {
  @IsOptional() @IsIn(SERVICE_REQUEST_TYPES) type?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180) requesterName?: string;
  @IsOptional() @IsEmail() @MaxLength(190) requesterEmail?: string;
  @IsOptional() @IsString() @MaxLength(20) requesterRut?: string;
  @IsOptional() @IsString() @MaxLength(50) requesterPhone?: string;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
  @IsOptional() @IsIn(SERVICE_REQUEST_STATUSES) status?: string;
  @IsOptional() @IsString() @MaxLength(3000) resolutionNote?: string;
}
