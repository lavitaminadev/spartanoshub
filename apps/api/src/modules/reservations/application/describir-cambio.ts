/**
 * @fileoverview Un cambio de la auditoría, dicho como lo diría quien lo hizo.
 *
 * La auditoría guarda la ruta por la que entró cada cambio —`request:patch:reservations/forms/…`—
 * y el cuerpo que se mandó. Para el dueño que revisa qué pasó anoche, eso no dice nada: necesita
 * leer «bajó el cupo a 18» o «cerró el sábado», no una URL.
 */

const CAMPOS_DEL_DIA: Record<string, (valor: unknown) => string> = {
  capacityPerSlot: (valor) => `dejó el cupo por franja en ${valor}`,
  dailyCapacity: (valor) => (Number(valor) > 0 ? `puso el tope del día en ${valor}` : 'quitó el tope del día'),
  toleranciaMinutos: (valor) => (Number(valor) > 0 ? `cambió la tolerancia a ${valor} min` : 'quitó la tolerancia'),
  notasDelLocal: (valor) => (String(valor ?? '').trim() ? 'cambió el aviso antes de reservar' : 'quitó el aviso antes de reservar'),
  whatsappBusinessNumber: () => 'cambió el WhatsApp del local',
  zonasActivas: () => 'cambió las zonas que reciben hoy',
};

/**
 * @param reason La marca que deja el interceptor: `request:<método>:<ruta>`.
 * @param after El cuerpo de la petición, ya saneado.
 */
export function describirCambio(reason: string, after: unknown): string {
  const cuerpo = (after && typeof after === 'object' ? after : {}) as Record<string, unknown>;
  const [, metodo = '', ruta = ''] = reason.split(':');

  if (ruta.endsWith('/pause')) return cuerpo.until ? 'pausó las reservas' : 'reanudó las reservas';
  if (ruta.endsWith('/blocks') || ruta.endsWith('/blocks/batch')) return 'cerró un día o un tramo';
  if (metodo === 'delete' && ruta.includes('/blocks/')) return 'quitó un cierre';
  if (ruta.endsWith('/operacion')) {
    const partes = Object.keys(cuerpo).filter((clave) => clave in CAMPOS_DEL_DIA).map((clave) => CAMPOS_DEL_DIA[clave](cuerpo[clave]));
    return partes.length ? partes.join(', ') : 'cambió los ajustes del día';
  }
  if (ruta.endsWith('/duplicate')) return 'duplicó esta reserva';
  if (metodo === 'patch' && /\/forms\/[^/]+$/.test(ruta)) {
    if (cuerpo.status === 'published') return 'publicó la reserva';
    if (cuerpo.status === 'paused') return 'pausó la reserva';
    return 'editó la configuración';
  }
  return 'hizo un cambio';
}
