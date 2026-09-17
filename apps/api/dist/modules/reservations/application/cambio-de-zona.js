"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluarCambioDeZona = evaluarCambioDeZona;
function evaluarCambioDeZona(cambio) {
    const zona = cambio.zonas.find((item) => item.id === cambio.destino);
    if (!zona)
        return { motivo: 'inexistente', mensaje: 'Esa zona no existe en esta reserva' };
    const nombre = zona.name?.trim() || 'Esa zona';
    if (zona.active === false) {
        return { motivo: 'apagada', mensaje: `${nombre} está apagada: enciéndela en los ajustes del día antes de asignarla` };
    }
    const cupo = Math.max(1, Number(zona.capacity) || cambio.capacidadDelLocal);
    if (cambio.ocupado + cambio.personas > cupo) {
        return { motivo: 'sin-espacio', mensaje: `${nombre} no tiene espacio a esa hora: ${cambio.ocupado} de ${cupo} ocupados` };
    }
    return null;
}
