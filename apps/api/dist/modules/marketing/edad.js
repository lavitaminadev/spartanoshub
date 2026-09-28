"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZONA_DEL_NEGOCIO = exports.MAYORIA_DE_EDAD = void 0;
exports.diaDelAnoEn = diaDelAnoEn;
exports.cumpleHoy = cumpleHoy;
exports.edadEn = edadEn;
exports.puedeRecibirPorEdad = puedeRecibirPorEdad;
exports.MAYORIA_DE_EDAD = 18;
exports.ZONA_DEL_NEGOCIO = 'America/Santiago';
function diaDelAnoEn(momento, zona = exports.ZONA_DEL_NEGOCIO) {
    const partes = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(momento)
        .reduce((acumulado, parte) => ({ ...acumulado, [parte.type]: parte.value }), {});
    return { ano: Number(partes.year), mes: Number(partes.month) - 1, dia: Number(partes.day) };
}
function cumpleHoy(nacimiento, hoy = new Date(), zona = exports.ZONA_DEL_NEGOCIO) {
    const mes = nacimiento.getMonth();
    const dia = nacimiento.getDate();
    const local = diaDelAnoEn(hoy, zona);
    if (mes === local.mes && dia === local.dia)
        return true;
    const bisiesto = new Date(local.ano, 1, 29).getMonth() === 1;
    const naceEn29DeFebrero = mes === 1 && dia === 29;
    const hoyEs28DeFebrero = local.mes === 1 && local.dia === 28;
    return naceEn29DeFebrero && hoyEs28DeFebrero && !bisiesto;
}
function edadEn(nacimiento, hoy = new Date()) {
    if (!nacimiento)
        return null;
    const fecha = nacimiento instanceof Date ? nacimiento : new Date(nacimiento);
    if (Number.isNaN(fecha.getTime()))
        return null;
    let anos = hoy.getFullYear() - fecha.getFullYear();
    const yaCumplio = hoy.getMonth() > fecha.getMonth()
        || (hoy.getMonth() === fecha.getMonth() && hoy.getDate() >= fecha.getDate());
    if (!yaCumplio)
        anos -= 1;
    return anos;
}
function puedeRecibirPorEdad(nacimiento, hoy = new Date()) {
    const edad = edadEn(nacimiento, hoy);
    if (edad === null)
        return true;
    return edad >= exports.MAYORIA_DE_EDAD;
}
