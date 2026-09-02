import { vi } from 'vitest';

/**
 * Doble de la lista de personas que pueden atender el CRM de una empresa.
 *
 * El caso de uso la consulta solo para decidir si quien mueve un lead sin dueño es el único que
 * podría atenderlo. La lista vacía es el valor por defecto porque deja esa regla en reposo: las
 * pruebas que miran otra cosa no tienen que declarar un equipo que no les importa.
 *
 * @param equipo - Quiénes pueden hacerse cargo. Uno solo activa la autoasignación.
 */
export function createResponsablesDouble(equipo: { id: string; name: string }[] = []) {
  return { execute: vi.fn().mockResolvedValue(equipo) } as never;
}
