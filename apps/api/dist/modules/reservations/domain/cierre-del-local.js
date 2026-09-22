"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MINUTOS_POR_EXTENSION = void 0;
exports.horaDeCierre = horaDeCierre;
exports.finExtendido = finExtendido;
const timezone_1 = require("./timezone");
exports.MINUTOS_POR_EXTENSION = 30;
const aMinutos = (hora) => {
    const partes = /^(\d{1,2}):(\d{2})$/.exec(hora);
    return partes ? Number(partes[1]) * 60 + Number(partes[2]) : -1;
};
function horaDeCierre(inicio, zonaHoraria, tramos) {
    const local = (0, timezone_1.zonedParts)(inicio, zonaHoraria);
    const minuto = local.hour * 60 + local.minute;
    const tramo = tramos
        .filter((item) => item.day === local.weekday && aMinutos(item.start) <= minuto && minuto < aMinutos(item.end))
        .sort((a, b) => aMinutos(b.end) - aMinutos(a.end))[0];
    if (!tramo)
        return null;
    const fin = aMinutos(tramo.end);
    const fecha = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
    const medianoche = (0, timezone_1.tryLocalToUtc)(fecha, '00:00', zonaHoraria);
    if (!medianoche)
        return null;
    if (fin >= 24 * 60)
        return new Date(medianoche.getTime() + 24 * 3600_000);
    return (0, timezone_1.tryLocalToUtc)(fecha, `${String(Math.floor(fin / 60)).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`, zonaHoraria);
}
function finExtendido(finActual, ahora) {
    return new Date(Math.max(finActual.getTime(), ahora.getTime()) + exports.MINUTOS_POR_EXTENSION * 60_000);
}
