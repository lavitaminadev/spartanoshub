"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANTICIPO_ALERTA_HORAS = void 0;
exports.plazoDeAviso = plazoDeAviso;
const shared_1 = require("@espartanos/shared");
const HORA_MS = 3_600_000;
exports.ANTICIPO_ALERTA_HORAS = 24;
function plazoDeAviso(detectadoEl, avisoLocalEl, ahora = new Date()) {
    const vence = new Date(new Date(detectadoEl).getTime() + shared_1.PLAZO_AVISO_VULNERACION_HORAS * HORA_MS);
    const horasRestantes = (vence.getTime() - ahora.getTime()) / HORA_MS;
    if (avisoLocalEl)
        return { vence, horasRestantes, estado: 'avisado' };
    if (horasRestantes <= 0)
        return { vence, horasRestantes, estado: 'vencido' };
    return { vence, horasRestantes, estado: horasRestantes <= exports.ANTICIPO_ALERTA_HORAS ? 'por vencer' : 'a tiempo' };
}
