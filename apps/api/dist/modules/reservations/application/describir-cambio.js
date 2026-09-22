"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describirCambio = describirCambio;
const CAMPOS_DEL_DIA = {
    capacityPerSlot: (valor) => `dejó el cupo por franja en ${valor}`,
    dailyCapacity: (valor) => (Number(valor) > 0 ? `puso el tope del día en ${valor}` : 'quitó el tope del día'),
    toleranciaMinutos: (valor) => (Number(valor) > 0 ? `cambió la tolerancia a ${valor} min` : 'quitó la tolerancia'),
    notasDelLocal: (valor) => (String(valor ?? '').trim() ? 'cambió el aviso antes de reservar' : 'quitó el aviso antes de reservar'),
    whatsappBusinessNumber: () => 'cambió el WhatsApp del local',
    zonasActivas: () => 'cambió las zonas que reciben hoy',
};
function describirCambio(reason, after) {
    const cuerpo = (after && typeof after === 'object' ? after : {});
    const [, metodo = '', ruta = ''] = reason.split(':');
    if (ruta.endsWith('/pause'))
        return cuerpo.until ? 'pausó las reservas' : 'reanudó las reservas';
    if (ruta.endsWith('/blocks') || ruta.endsWith('/blocks/batch'))
        return 'cerró un día o un tramo';
    if (metodo === 'delete' && ruta.includes('/blocks/'))
        return 'quitó un cierre';
    if (ruta.endsWith('/operacion')) {
        const partes = Object.keys(cuerpo).filter((clave) => clave in CAMPOS_DEL_DIA).map((clave) => CAMPOS_DEL_DIA[clave](cuerpo[clave]));
        return partes.length ? partes.join(', ') : 'cambió los ajustes del día';
    }
    if (ruta.endsWith('/duplicate'))
        return 'duplicó esta reserva';
    if (metodo === 'patch' && /\/forms\/[^/]+$/.test(ruta)) {
        if (cuerpo.status === 'published')
            return 'publicó la reserva';
        if (cuerpo.status === 'paused')
            return 'pausó la reserva';
        return 'editó la configuración';
    }
    return 'hizo un cambio';
}
