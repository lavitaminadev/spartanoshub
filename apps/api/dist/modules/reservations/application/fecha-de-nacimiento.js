"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fechaDeNacimientoValida = fechaDeNacimientoValida;
const EDAD_MAXIMA = 120;
function fechaDeNacimientoValida(valor) {
    const fecha = new Date(`${valor.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(fecha.getTime()))
        return false;
    const hoy = new Date();
    if (fecha.getTime() > hoy.getTime())
        return false;
    const limite = new Date(hoy);
    limite.setUTCFullYear(limite.getUTCFullYear() - EDAD_MAXIMA);
    return fecha.getTime() >= limite.getTime();
}
