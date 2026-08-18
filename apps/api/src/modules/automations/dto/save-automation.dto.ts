import { IsBoolean, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { AutomationGraph } from '../automation.entity';

/**
 * Alta y edición de una automatización.
 *
 * El grafo se declara como objeto y su forma la comprueba `assertValidGraph`, no los
 * decoradores: validar un grafo con anotaciones exigiría declarar cada tipo de nodo en el
 * DTO, y entonces agregar una acción obligaría a tocar el DTO, el catálogo y el editor en
 * vez de solo el catálogo.
 */
export class SaveAutomationDto {
  @IsString() @MinLength(3) @MaxLength(150) name: string;

  @IsOptional() @IsString() @MaxLength(500) description?: string;

  @IsString() @MaxLength(60) triggerType: string;

  @IsObject() graph: AutomationGraph;

  /** Persona en cuyo nombre actúa la automatización. Ver `Automation.runAsUserId`. */
  @IsUUID() runAsUserId: string;
}

export class SetAutomationActiveDto {
  @IsBoolean() isActive: boolean;
}
