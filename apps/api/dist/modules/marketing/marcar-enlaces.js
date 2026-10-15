"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nombreDeCampana = nombreDeCampana;
exports.marcarEnlacesPropios = marcarEnlacesPropios;
function nombreDeCampana(asunto) {
    const limpio = asunto
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return (limpio || 'campana').slice(0, 180);
}
function marcarEnlacesPropios(html, base, campana) {
    if (!base || !campana)
        return html;
    let origen;
    try {
        origen = new URL(base).origin;
    }
    catch {
        return html;
    }
    return html.replace(/href="([^"]+)"/g, (completo, url) => {
        let destino;
        try {
            destino = new URL(url);
        }
        catch {
            return completo;
        }
        if (destino.origin !== origen)
            return completo;
        if (destino.pathname.includes('/baja'))
            return completo;
        if (!destino.searchParams.has('utm_campaign')) {
            destino.searchParams.set('utm_source', 'campana');
            destino.searchParams.set('utm_medium', 'email');
            destino.searchParams.set('utm_campaign', campana);
        }
        return `href="${destino.toString().replace(/&/g, '&amp;')}"`;
    });
}
