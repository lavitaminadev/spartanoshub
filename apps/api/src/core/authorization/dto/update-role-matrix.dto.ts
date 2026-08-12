import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { PermissionLevel } from '../permission-level';

/**
 * Cuerpo para guardar la matriz de cargos.
 *
 * Se envía la matriz completa tal como se ve en pantalla; el backend calcula por sí mismo qué
 * celdas difieren del código y guarda solo esas. Enviarla entera evita que el panel tenga que
 * conocer los valores por defecto para decidir qué mandar, y deja la comparación en el único
 * lugar donde `role-permissions.ts` es la verdad.
 *
 * Los módulos y cargos se validan en el controlador contra el catálogo y el enum de cargos;
 * acá solo se comprueba la forma.
 */
export class UpdateRoleMatrixDto {
  /** `matrix[módulo][cargo] = nivel`. */
  @IsObject()
  matrix: Record<string, Record<string, PermissionLevel>>;

  /** Justificación del cambio, que viaja a la auditoría. */
  @IsOptional() @IsString() @MaxLength(300)
  reason?: string;
}
