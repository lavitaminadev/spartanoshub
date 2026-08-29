"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escaparHtml = escaparHtml;
exports.rellenar = rellenar;
exports.armazonDeCorreo = armazonDeCorreo;
exports.componerCorreo = componerCorreo;
const brand_1 = require("../../shared/brand");
function escaparHtml(valor) {
    return valor
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function rellenar(plantilla, variables) {
    return plantilla.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_todo, nombre) => {
        const valor = variables[nombre];
        if (valor === null || valor === undefined || valor === '')
            return '';
        return escaparHtml(String(valor));
    });
}
function comoParrafos(texto) {
    return texto
        .split(/\n{2,}/)
        .map((parrafo) => parrafo.trim())
        .filter(Boolean)
        .map((parrafo) => `<p style="margin:0 0 14px;">${parrafo.replace(/\n/g, '<br>')}</p>`)
        .join('');
}
function urlDelLogo() {
    const base = process.env.APP_PUBLIC_URL?.replace(/\/$/, '') ?? '';
    return `${base}/brand/espartanos-helmet.png`;
}
function armazonDeCorreo(titulo, cuerpo, accion) {
    const boton = accion
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;">
         <tr><td style="border-radius:8px;background:#ea0f63;">
           <a href="${escaparHtml(accion.url)}"
              style="display:inline-block;padding:11px 22px;font-family:Helvetica,Arial,sans-serif;
                     font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
             ${escaparHtml(accion.texto)}
           </a>
         </td></tr>
       </table>`
        : '';
    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escaparHtml(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:22px 26px 6px;">
              <img src="${escaparHtml(urlDelLogo())}" alt="${escaparHtml(brand_1.BRAND.name)}" width="36" height="36"
                   style="display:block;border:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;
                          font-weight:700;color:#ea0f63;">
            </td>
          </tr>
          <tr>
            <td style="padding:8px 26px 26px;font-family:Helvetica,Arial,sans-serif;font-size:15px;
                       line-height:1.55;color:#22242a;">
              <h1 style="margin:0 0 14px;font-size:19px;line-height:1.3;color:#101114;">
                ${escaparHtml(titulo)}
              </h1>
              ${comoParrafos(cuerpo)}
              ${boton}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 26px 22px;border-top:1px solid #ececf0;
                       font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7a7d87;">
              ${escaparHtml(brand_1.BRAND.teamSignature)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
function componerCorreo(asunto, cuerpo, variables, accion) {
    const subject = asunto.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_todo, nombre) => {
        const valor = variables[nombre];
        return valor === null || valor === undefined ? '' : String(valor);
    }).replace(/\s+/g, ' ').trim();
    return { subject, html: armazonDeCorreo(subject, rellenar(cuerpo, variables), accion) };
}
