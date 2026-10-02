import { vi } from 'vitest';

/**
 * Doble de la automatización del CRM para las pruebas del caso de uso de actualizar un lead.
 *
 * Sólo se usa una de sus capacidades: dejar la constancia del cierre en el historial. El resto
 * —contactos, oportunidades— pertenece al ingreso de la ficha y no se toca al editarla, así que
 * no hace falta fingirlo.
 *
 * Devuelve el espía para poder afirmar que el descarte quedó anotado, que es justamente lo que
 * faltaba: la automatización real sólo corre al crear el lead, así que un descarte posterior no
 * escribía nada.
 */
export function createAutomatizacionDouble() {
  return { ensureDiscardInteraction: vi.fn().mockResolvedValue(undefined) };
}
