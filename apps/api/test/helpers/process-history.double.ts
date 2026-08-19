import { vi } from 'vitest';
import type { ProcessHistoryService } from '../../src/core/process-history/process-history.service';

/**
 * Doble del registro de recorrido para las pruebas que construyen un servicio a mano.
 *
 * Vive acá y no repetido en cada archivo por una razón concreta: el registro lo usan tres
 * módulos que no se conocen entre sí, y cada uno tiene sus propias pruebas. Con una copia por
 * archivo, agregar un método al servicio obliga a tocar todos, y el que se olvide falla con un
 * `undefined is not a function` que no dice cuál es el problema.
 *
 * Devuelve funciones espía para poder afirmar que una transición quedó registrada, no solo que
 * el código no reventó al intentarlo.
 */
export function createProcessHistoryDouble() {
  return {
    recordCreated: vi.fn().mockResolvedValue(undefined),
    recordStageChange: vi.fn().mockResolvedValue(undefined),
    timeline: vi.fn().mockResolvedValue([]),
    stageDurations: vi.fn().mockResolvedValue([]),
  } as unknown as ProcessHistoryService & {
    recordCreated: ReturnType<typeof vi.fn>;
    recordStageChange: ReturnType<typeof vi.fn>;
  };
}
