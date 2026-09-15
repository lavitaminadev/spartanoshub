"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imagenParaCompartir = imagenParaCompartir;
exports.primeraImagen = primeraImagen;
exports.htmlDeVistaPrevia = htmlDeVistaPrevia;
const escapar = (texto) => texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function imagenParaCompartir(url) {
    if (!url || !/^https:\/\//i.test(url) || url.length > 2048)
        return null;
    if (/res\.cloudinary\.com\/.+\/image\/upload\//.test(url))
        return url.replace('/image/upload/', '/image/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/');
    return url;
}
function primeraImagen(...candidatas) {
    for (const candidata of candidatas) {
        const imagen = imagenParaCompartir(candidata);
        if (imagen)
            return imagen;
    }
    return null;
}
function htmlDeVistaPrevia({ titulo, descripcion, url, imagen, sitio = 'Espartanos' }) {
    const t = escapar(titulo.slice(0, 120));
    const d = escapar(descripcion.replace(/\s+/g, ' ').trim().slice(0, 300));
    const u = escapar(url);
    const img = imagen ? escapar(imagen) : '';
    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapar(sitio)}">
<meta property="og:locale" content="es_CL">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
${img ? `<meta property="og:image" content="${img}">
<meta property="og:image:secure_url" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${t}">` : ''}
<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
${img ? `<meta name="twitter:image" content="${img}">` : ''}
<link rel="canonical" href="${u}">
<meta http-equiv="refresh" content="0;url=${u}">
</head>
<body><a href="${u}">${t}</a></body>
</html>`;
}
