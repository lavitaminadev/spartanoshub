export type ServicioDeEmpresa = 'crm' | 'reservations' | 'surveys';

/**
 * Las empresas que tienen un servicio, para los selectores de ese módulo.
 *
 * Misma regla que el servidor: apagado es solo `false` explícito; sin la clave, el servicio está
 * encendido. Una empresa sin el servicio no se ofrece: elegirla abría un módulo que la API ya
 * rechaza y dejaba su nombre a la vista donde no corresponde.
 *
 * @param conservar - Una empresa que ya está elegida o guardada y se mantiene aunque esté
 *   apagada, para no cambiar en silencio lo que la persona está mirando.
 */
export function empresasConServicio<T extends { id: string; capabilities?: Partial<Record<string, boolean>> | null }>(
  empresas: T[],
  servicio: ServicioDeEmpresa,
  conservar?: string | null,
): T[] {
  return empresas.filter((empresa) => empresa.capabilities?.[servicio] !== false || (conservar != null && empresa.id === conservar));
}
