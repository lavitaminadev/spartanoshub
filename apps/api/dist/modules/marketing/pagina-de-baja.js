"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginaDeBaja = paginaDeBaja;
const brand_1 = require("../../shared/brand");
function escapar(valor) {
    return valor.replace(/[&<>"']/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter]);
}
function paginaDeBaja(resultado, token, origen) {
    const sufijo = origen ? `&origen=${encodeURIComponent(origen)}` : '';
    const enlaceTodas = `/api/marketing/suscriptores/baja/${encodeURIComponent(token)}?alcance=todas${sufijo}`;
    const cuerpo = !resultado
        ? `<h1>Este enlace ya no sirve</h1>
       <p>Puede que ya lo hayas usado o que el correo sea muy antiguo. Si sigues recibiendo correos
          nuestros, escríbenos y lo resolvemos.</p>`
        : resultado.alcance === 'todas'
            ? `<h1>Listo</h1>
         <p>No recibirás más correos comerciales nuestros, de ninguno de los locales.</p>
         <p class="nota">Las confirmaciones de una reserva que hagas siguen llegando: no son
            publicidad, son parte de lo que pediste.</p>`
            : `<h1>Listo</h1>
         <p>No recibirás más correos comerciales de este local.</p>
         <p class="nota">Si reservaste en otro local nuestro, sus correos siguen llegando por
            separado.</p>
         <a class="boton" href="${escapar(enlaceTodas)}">Darme de baja de todos</a>`;
    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Baja de correos · ${escapar(brand_1.BRAND.name)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:24px 16px; background:#f4f4f6; color:#22242a;
         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; }
  main { max-width:520px; margin:0 auto; background:#fff; border-radius:14px; padding:28px 26px; }
  h1 { margin:0 0 12px; font-size:22px; line-height:1.25; }
  p { margin:0 0 12px; font-size:15px; line-height:1.55; }
  .nota { color:#6b6e78; font-size:13px; }
  .boton { display:inline-block; margin-top:8px; padding:11px 20px; border-radius:8px;
           background:#ea0f63; color:#fff; font-size:14px; font-weight:600; text-decoration:none; }
  .pie { margin-top:22px; padding-top:16px; border-top:1px solid #ececf0; font-size:13px; color:#6b6e78; }
  .pie a { color:#ea0f63; }
  @media (prefers-color-scheme: dark) {
    body { background:#17181c; color:#e9eaee; }
    main { background:#212329; }
    .nota, .pie { color:#a0a3ad; }
    .pie { border-top-color:#31343c; }
  }
</style>
</head>
<body>
  <main>
    ${cuerpo}
    <div class="pie">
      Darte de baja detiene la publicidad, pero no borra tus datos: guardamos la constancia de que
      pediste no recibir más, que es lo que nos permite cumplirlo.
      Si además quieres acceder a tus datos, corregirlos o que los borremos,
      <a href="/solicitudes">pídelo por aquí</a>.
    </div>
  </main>
</body>
</html>`;
}
