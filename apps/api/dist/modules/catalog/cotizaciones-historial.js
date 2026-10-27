"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raizDeLaFamilia = raizDeLaFamilia;
exports.arbolDeVersiones = arbolDeVersiones;
exports.resumenDeCotizaciones = resumenDeCotizaciones;
exports.patronDeBusqueda = patronDeBusqueda;
function raizDeLaFamilia(cotizacion) {
    return cotizacion.parentQuoteId ?? cotizacion.id;
}
function arbolDeVersiones(familia, consultadaId) {
    return [...familia]
        .sort((a, b) => Number(a.version) - Number(b.version) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((c) => ({
        id: c.id,
        number: c.number,
        version: Number(c.version),
        status: String(c.status),
        amount: Number(c.amount),
        currency: c.currency,
        sentAt: c.sentAt ?? null,
        acceptedAt: c.acceptedAt ?? null,
        createdAt: c.createdAt,
        actual: c.id === consultadaId,
    }));
}
function resumenDeCotizaciones(cotizaciones) {
    const familias = new Set();
    let ultima = null;
    for (const c of cotizaciones) {
        const salio = c.sentAt ?? c.acceptedAt ?? null;
        if (!salio)
            continue;
        familias.add(raizDeLaFamilia(c));
        const fecha = new Date(salio);
        if (!ultima || fecha.getTime() > ultima.getTime())
            ultima = fecha;
    }
    return { veces: familias.size, ultimaEn: ultima };
}
function patronDeBusqueda(texto) {
    const limpio = (texto ?? '').replace(/[%_\\]/g, ' ').replace(/\s+/g, ' ').trim();
    return limpio ? `%${limpio}%` : undefined;
}
