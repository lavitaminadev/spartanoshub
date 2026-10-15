import { vi } from 'vitest';

/**
 * Doble de las casillas que reciben los avisos del equipo.
 *
 * `ReservationsService` le pide una lista por tipo de aviso antes de armar cada correo, dentro
 * de un `try` que sólo deja una línea en el log. Pasar `{}` hacía que la llamada lanzara
 * «Cannot read properties of undefined» y que el aviso no se armara: la prueba pasaba sin haber
 * ejercitado el envío, y el mensaje que quedaba en el log era idéntico al de una rotura real.
 *
 * La lista por defecto es la del formulario y nada más —lo que el servicio ya le pasa como
 * cuarto argumento—, porque es el caso de una empresa que no configuró casillas aparte: deja la
 * regla en reposo sin que la prueba tenga que declarar destinatarios que no le importan.
 *
 * @param correos - Casillas fijas a devolver, cuando la prueba sí quiere comprobar a quién le
 *   llega.
 */
export function createDestinatariosDeAvisosDouble(correos?: string[]) {
  return {
    para: vi.fn(async (
      _organizationId: string,
      _clientId: string | null | undefined,
      _tipo: string,
      delFormulario: string[] = [],
    ) => correos ?? delFormulario),
  } as never;
}
