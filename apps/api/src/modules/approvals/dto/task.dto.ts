import { IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApprovalRequestStatus } from '../approval-request-status.enum';
import { TASK_ENTITY_TYPES } from '../tasks.service';

export class CreateTaskDto {
  @IsString() @MinLength(3) @MaxLength(255) title: string;

  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  /** Registro al que pertenece. La lista es cerrada: ver `TASK_ENTITY_TYPES`. */
  @IsIn([...TASK_ENTITY_TYPES]) entityType: string;

  @IsUUID() entityId: string;

  /**
   * Cuenta a la que pertenece, cuando la hay.
   *
   * Una tarea sobre un prospecto comercial no tiene cliente todavía, así que es opcional.
   */
  @IsOptional() @IsUUID() clientId?: string;

  @IsOptional() @IsUUID() assignedTo?: string;

  @IsOptional() @IsDateString() dueAt?: string;
}

export class UpdateTaskDto {
  @IsOptional() @IsEnum(ApprovalRequestStatus) status?: ApprovalRequestStatus;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(255) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  /**
   * Cadena vacía desasigna.
   *
   * Se acepta como texto y no como UUID para poder distinguir «quítale el responsable» de «no
   * toques el responsable», que con un UUID opcional serían lo mismo.
   */
  @IsOptional() @IsString() @MaxLength(36) assignedTo?: string;

  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() @MaxLength(5000) decisionNotes?: string;
}
