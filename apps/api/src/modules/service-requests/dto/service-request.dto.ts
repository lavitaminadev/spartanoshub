import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SERVICE_REQUEST_STATUSES, SERVICE_REQUEST_TYPES } from '../service-requests.service';

export class CreateServiceRequestDto {
  @IsString() @IsIn(SERVICE_REQUEST_TYPES) type: string;
  @IsString() @MinLength(2) @MaxLength(180) requesterName: string;
  @IsEmail() @MaxLength(190) requesterEmail: string;
  @IsOptional() @IsString() @MaxLength(20) requesterRut?: string;
  @IsOptional() @IsString() @MaxLength(50) requesterPhone?: string;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
  /** Honeypot anti-spam: un robot rellena este campo y la solicitud se descarta. */
  @IsOptional() @IsString() website?: string;
}

export class ResolveServiceRequestDto {
  @IsIn(SERVICE_REQUEST_STATUSES) status: string;
  @IsOptional() @IsString() @MaxLength(3000) resolutionNote?: string;
}
