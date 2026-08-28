"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.construirFbc = construirFbc;
exports.atribucionDelLead = atribucionDelLead;
const INDICE_DE_SUBDOMINIO = 1;
function construirFbc(fbclid, visto) {
    const valor = fbclid?.trim();
    if (!valor || !visto)
        return undefined;
    const instante = visto instanceof Date ? visto : new Date(visto);
    if (Number.isNaN(instante.getTime()))
        return undefined;
    return `fb.${INDICE_DE_SUBDOMINIO}.${instante.getTime()}.${valor}`;
}
function atribucionDelLead(lead) {
    const guardado = (lead.metadata?.attribution ?? {});
    return {
        fbp: guardado.fbp || undefined,
        fbc: guardado.fbc || construirFbc(guardado.fbclid, guardado.capturedAt),
        clientIpAddress: guardado.clientIpAddress || undefined,
        clientUserAgent: guardado.clientUserAgent || undefined,
    };
}
