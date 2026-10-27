"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MUESTRA_MINIMA_POR_DIA = void 0;
exports.resumirAsistenciaDelComensal = resumirAsistenciaDelComensal;
exports.noShowPorLocalYDia = noShowPorLocalYDia;
const timezone_1 = require("../domain/timezone");
const ESTADOS_CANCELADOS = new Set(['cancelled', 'cancelled_client', 'cancelled_business']);
function veces(cantidad) {
    return cantidad === 1 ? '1 vez' : `${cantidad} veces`;
}
function resumirAsistenciaDelComensal(anteriores, ahora) {
    const pasadas = anteriores.filter((reserva) => reserva.startsAt.getTime() <= ahora.getTime());
    const asistio = pasadas.filter((reserva) => reserva.status === 'attended').length;
    const noAsistio = pasadas.filter((reserva) => reserva.status === 'no_show').length;
    const canceladas = pasadas.filter((reserva) => ESTADOS_CANCELADOS.has(reserva.status)).length;
    const debianPresentarse = asistio + noAsistio;
    let frase = 'Sin reservas anteriores con resultado en esta empresa.';
    if (debianPresentarse > 0) {
        frase = noAsistio === 0
            ? `Se presentó ${veces(asistio)} de ${debianPresentarse}.`
            : `No se presentó ${noAsistio} de ${debianPresentarse} ${debianPresentarse === 1 ? 'vez' : 'veces'}.`;
    }
    return {
        conDesenlace: asistio + noAsistio + canceladas,
        asistio,
        noAsistio,
        canceladas,
        proporcionNoShow: debianPresentarse > 0 ? noAsistio / debianPresentarse : null,
        frase,
        ultimas: [...pasadas]
            .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
            .slice(0, 5)
            .map((reserva) => ({ id: reserva.id, startsAt: reserva.startsAt, status: reserva.status })),
    };
}
const NOMBRE_DEL_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
exports.MUESTRA_MINIMA_POR_DIA = 5;
function tasaDe(noAsistio, total) {
    return total > 0 ? noAsistio / total : null;
}
function noShowPorLocalYDia(reservas, locales) {
    return locales.map((local) => {
        const dias = NOMBRE_DEL_DIA.map((nombre, dia) => ({ dia, nombre, total: 0, noAsistio: 0, tasa: null }));
        for (const reserva of reservas) {
            if (reserva.formId !== local.id)
                continue;
            if (reserva.status !== 'attended' && reserva.status !== 'no_show')
                continue;
            const fila = dias[(0, timezone_1.zonedParts)(reserva.startsAt, local.timezone).weekday];
            fila.total += 1;
            if (reserva.status === 'no_show')
                fila.noAsistio += 1;
        }
        for (const fila of dias)
            fila.tasa = tasaDe(fila.noAsistio, fila.total);
        const total = dias.reduce((suma, fila) => suma + fila.total, 0);
        const noAsistio = dias.reduce((suma, fila) => suma + fila.noAsistio, 0);
        const candidatos = dias.filter((fila) => fila.total >= exports.MUESTRA_MINIMA_POR_DIA && fila.noAsistio > 0);
        const peor = candidatos.sort((a, b) => (b.tasa ?? 0) - (a.tasa ?? 0))[0];
        return {
            formId: local.id,
            nombre: local.nombre,
            clientId: local.clientId,
            total,
            noAsistio,
            tasa: tasaDe(noAsistio, total),
            porDia: dias,
            peorDia: peor && peor.tasa !== null
                ? { nombre: peor.nombre, tasa: peor.tasa, frase: `Los ${peor.dia === 0 || peor.dia === 6 ? `${peor.nombre}s` : peor.nombre} falla el ${Math.round(peor.tasa * 100)}%.` }
                : null,
        };
    });
}
