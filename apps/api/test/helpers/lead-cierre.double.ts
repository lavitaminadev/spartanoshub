import { vi } from 'vitest';

/**
 * Doble del aviso de cierre.
 *
 * Las pruebas del caso de uso comprueban qué se guarda, no a quién se avisa. Sin este doble no se
 * puede construir la clase, y montar el servicio de verdad arrastraría la tabla de avisos a una
 * prueba que no la toca.
 */
export function createLeadCierreDouble() {
  return { avisar: vi.fn().mockResolvedValue(undefined) } as never;
}
