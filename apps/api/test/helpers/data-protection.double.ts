import { vi } from 'vitest';

/**
 * Doble del servicio de protección de datos que usa el trabajo de retención.
 *
 * El trabajo recorre los plazos publicados paso a paso, y cada paso va en su propio `try` para
 * que un fallo no frene a los demás. Esa misma independencia es la que escondía el problema: un
 * doble que sólo traía `anonymizeLead` y `anonymizeExpiredReservations` dejaba los otros tres
 * pasos lanzando «is not a function», el trabajo los registraba como fallidos y la prueba pasaba
 * igual. En el log quedaban tres errores que se leen exactamente igual que una rotura real.
 *
 * Cada paso devuelve cuántas filas tocó, así que el valor por defecto es cero: nada vencido, que
 * es el caso en reposo y el que deja a las pruebas de `anonymizeLead` mirando sólo lo suyo.
 *
 * @param tocadas - Cuántas filas declara cada paso, cuando la prueba quiere comprobar el recuento.
 */
export function createDataProtectionDouble(tocadas: Partial<Record<
  'medicion' | 'solicitudesDeGrupo' | 'respuestasDeEncuesta', number
>> = {}) {
  return {
    anonymizeLead: vi.fn(),
    anonymizeExpiredReservations: vi.fn().mockResolvedValue({ reviewed: 0, anonymized: 0 }),
    borrarIdentificadoresDeMedicionVencidos: vi.fn().mockResolvedValue(tocadas.medicion ?? 0),
    anonimizarSolicitudesDeGrupoVencidas: vi.fn().mockResolvedValue(tocadas.solicitudesDeGrupo ?? 0),
    anonimizarRespuestasDeEncuestaVencidas: vi.fn().mockResolvedValue(tocadas.respuestasDeEncuesta ?? 0),
  };
}
