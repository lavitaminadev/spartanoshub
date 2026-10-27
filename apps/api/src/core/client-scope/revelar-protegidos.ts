import { ForbiddenException } from '@nestjs/common';
import type { NivelDeDatosProtegidos } from '@espartanos/shared';
import type { AuditService } from '../audit/audit.service';

/**
 * Deja constancia de que alguien pidió ver datos protegidos, o lo impide.
 *
 * - `oculto`: no hay forma de pedirlos; responde 403 y no anota nada.
 * - `bajo_registro`: anota quién, qué registro y qué campos **antes** de que el dato salga. Si la
 *   anotación falla, la excepción sube y el dato no se entrega.
 * - `directo`: ya los recibía; no hay nada que anotar.
 */
export async function exigirConstanciaDeRevelacion(
  audit: Pick<AuditService, 'log'>,
  nivel: NivelDeDatosProtegidos,
  constancia: { organizationId: string; actorId: string; entityType: string; entityId: string; campos: readonly string[]; ipAddress?: string },
): Promise<void> {
  if (nivel === 'oculto') throw new ForbiddenException('Tu perfil no permite ver estos datos');
  if (nivel !== 'bajo_registro') return;
  await audit.log({
    organizationId: constancia.organizationId,
    actorId: constancia.actorId,
    entityType: constancia.entityType,
    entityId: constancia.entityId,
    action: 'reveal_protected_data',
    reason: `campos=${constancia.campos.join(',')}`,
    ipAddress: constancia.ipAddress,
  });
}
