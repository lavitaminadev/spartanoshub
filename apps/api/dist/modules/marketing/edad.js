"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAYORIA_DE_EDAD = void 0;
exports.cumpleHoy = cumpleHoy;
exports.edadEn = edadEn;
exports.puedeRecibirPorEdad = puedeRecibirPorEdad;
exports.MAYORIA_DE_EDAD = 18;
function cumpleHoy(nacimiento, hoy = new Date()) {
    const mes = nacimiento.getMonth();
    const dia = nacimiento.getDate();
    if (mes === hoy.getMonth() && dia === hoy.getDate())
        return true;
    const bisiesto = new Date(hoy.getFullYear(), 1, 29).getMonth() === 1;
    const naceEn29DeFebrero = mes === 1 && dia === 29;
    const hoyEs28DeFebrero = hoy.getMonth() === 1 && hoy.getDate() === 28;
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
