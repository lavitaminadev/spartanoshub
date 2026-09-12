import { BRAND } from '../../shared/brand';

/**
 * El armazón de todos los correos que salen del sistema, y cómo se rellenan sus plantillas.
 *
 * Quien edita una plantilla escribe **texto con variables**, no HTML. El HTML lo pone este
 * módulo y nadie puede tocarlo. No es una limitación por comodidad: el HTML de correo es
 * primitivo —sin hojas de estilo externas, sin JavaScript, con estilos escritos dentro de cada
 * etiqueta— y Gmail y Outlook borran casi todo lo demás. Un texto pegado desde Word rompe el
 * correo entero, y quien lo pegó no tiene forma de saberlo hasta que alguien se queja.
 *
 * Separarlo así resuelve tres problemas a la vez: el correo nunca se rompe, las variables se
 * escapan al sustituirse —así que un nombre con `<` no puede inyectar nada— y una plantilla a la
 * que le falte una variable sale sin ese dato en vez de fallar.
 */

/** Valores que se pueden meter en una plantilla. Se convierten a texto al sustituir. */
export type VariablesDePlantilla = Record<string, string | number | null | undefined>;

/**
 * Escapa lo que va a acabar dentro del HTML.
 *
 * Se aplica a **todo** valor sustituido, sin excepción. Los datos vienen de formularios que
 * rellena cualquiera: un nombre puede traer `<script>` sin que nadie lo haya escrito con mala
 * intención, y el correo llega igual a la bandeja de otra persona.
 */
export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sustituye `{{variable}}` por su valor, ya escapado.
 *
 * Lo que no tenga valor se reemplaza por vacío y no por el nombre de la variable: dejar
 * `{{responsable}}` a la vista en un correo real es peor que la frase incompleta, porque delata
 * que el sistema falló en algo que nadie sabe qué era.
 *
 * @param plantilla - Texto con variables, tal como lo escribió una persona.
 * @param variables - Los valores de esta vez.
 */
export function rellenar(plantilla: string, variables: VariablesDePlantilla): string {
  return plantilla.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_todo, nombre: string) => {
    const valor = variables[nombre];
    if (valor === null || valor === undefined || valor === '') return '';
    return escaparHtml(String(valor));
  });
}

/**
 * Convierte el cuerpo escrito a mano en párrafos de HTML.
 *
 * Una línea en blanco separa párrafos y un salto simple es un salto de línea, que es como
 * cualquiera espera que se comporte un cuadro de texto. Sin esto, todo el mensaje llegaría como
 * un único bloque corrido, porque el HTML ignora los saltos de línea.
 */
function comoParrafos(texto: string): string {
  return texto
    .split(/\n{2,}/)
    .map((parrafo) => parrafo.trim())
    .filter(Boolean)
    .map((parrafo) => `<p style="margin:0 0 14px;">${parrafo.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Un botón, cuando el correo lleva a hacer algo concreto. */
export interface AccionDeCorreo {
  texto: string;
  url: string;
}

/**
 * Dónde vive el logo.
 *
 * **Alojado y no incrustado.** Gmail elimina los SVG de los correos por completo, y las imágenes
 * en `data:` las bloquea buena parte de los clientes. Un PNG con dirección absoluta es lo único
 * que se ve en todas partes; que algunos pidan permiso para mostrarlo la primera vez es el
 * precio, y por eso el texto de reemplazo lleva estilo: cuando la imagen no carga, se lee el
 * nombre de la marca en vez de un cuadro roto.
 */
function urlDelLogo(): string {
  const base = process.env.APP_PUBLIC_URL?.replace(/\/$/, '') ?? '';
  return `${base}/brand/espartanos-helmet.png`;
}

/**
 * Envuelve el cuerpo en el armazón de marca.
 *
 * Todo en tablas y con los estilos escritos dentro de cada etiqueta, que es lo único que
 * interpretan Outlook y Gmail por igual. El ancho máximo y el `viewport` hacen que se lea en un
 * teléfono sin tener que ampliar, que es donde se abre la mayoría de los correos.
 *
 * @param titulo - Encabezado dentro del correo. No es el asunto.
 * @param cuerpo - Texto ya rellenado, con sus saltos de línea.
 * @param accion - Botón opcional.
 */
/**
 * Bloque de tarjetas que el sistema arma —no la plantilla— y que se agrega bajo el cuerpo.
 *
 * Lo escribe el código y no quien edita el correo: el HTML de correo es frágil y una tabla mal
 * cerrada rompe el mensaje entero en Outlook. Las plantillas siguen siendo texto con variables.
 */
export interface TarjetaDeCorreo { titulo: string; texto?: string; imagen?: string }

function tarjetasDeCorreo(titulo: string, tarjetas: TarjetaDeCorreo[]): string {
  if (tarjetas.length === 0) return '';
  const celdas = tarjetas.map((tarjeta) => `
    <td width="50%" valign="top" style="padding:6px;">
      ${tarjeta.imagen ? `<img src="${escaparHtml(tarjeta.imagen)}" alt="" width="240" style="display:block;width:100%;max-width:240px;height:auto;border:0;border-radius:8px;">` : ''}
      <div style="margin-top:6px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#22242a;">${escaparHtml(tarjeta.titulo)}</div>
      ${tarjeta.texto ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.4;color:#7a7d87;">${escaparHtml(tarjeta.texto)}</div>` : ''}
    </td>`);
  // De a dos por fila: más columnas se rompen en el ancho de un teléfono.
  const filas: string[] = [];
  for (let indice = 0; indice < celdas.length; indice += 2) {
    filas.push(`<tr>${celdas.slice(indice, indice + 2).join('')}${celdas.length % 2 === 1 && indice + 2 > celdas.length - 1 ? '<td width="50%"></td>' : ''}</tr>`);
  }
  return `<div style="margin-top:22px;padding-top:16px;border-top:1px solid #ececf0;">
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#101114;">${escaparHtml(titulo)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${filas.join('')}</table>
    </div>`;
}

/**
 * Filas de «dato: valor» que acompañan al cuerpo, armadas por el sistema.
 *
 * La plantilla es texto con variables y no puede listar lo que cada local pregunta: son campos
 * distintos en cada sucursal. Esto las pinta sin que quien edita tenga que saber HTML.
 */
export interface DetalleDeCorreo { etiqueta: string; valor: string }

function detalleDeCorreo(filas: DetalleDeCorreo[]): string {
  if (filas.length === 0) return '';
  const celdas = filas.map((fila) => `<tr>
      <td style="padding:4px 10px 4px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#7a7d87;white-space:nowrap;">${escaparHtml(fila.etiqueta)}</td>
      <td style="padding:4px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#22242a;">${escaparHtml(fila.valor)}</td>
    </tr>`).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 2px;border-top:1px solid #ececf0;padding-top:10px;">${celdas}</table>`;
}

export function armazonDeCorreo(titulo: string, cuerpo: string, accion?: AccionDeCorreo, extra?: { titulo: string; tarjetas: TarjetaDeCorreo[] }, detalle?: DetalleDeCorreo[]): string {
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
              <img src="${escaparHtml(urlDelLogo())}" alt="${escaparHtml(BRAND.name)}" width="36" height="36"
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
              ${detalle ? detalleDeCorreo(detalle) : ''}
              ${boton}
              ${extra ? tarjetasDeCorreo(extra.titulo, extra.tarjetas) : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 26px 22px;border-top:1px solid #ececf0;
                       font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7a7d87;">
              ${escaparHtml(BRAND.teamSignature)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Un correo listo para enviar, a partir de una plantilla editable.
 *
 * @param asunto - Plantilla del asunto. También lleva variables: «Lead parado» sirve menos que
 *   «{{lead}} lleva {{dias}} días sin avanzar» cuando llegan varios seguidos.
 * @param cuerpo - Plantilla del cuerpo.
 * @param variables - Los valores de este envío.
 * @param accion - Botón opcional. Su texto y su dirección **no** salen de la plantilla: una
 *   dirección editable es una puerta abierta a que un correo con nuestra marca lleve a otro
 *   sitio.
 */
export function componerCorreo(
  asunto: string,
  cuerpo: string,
  variables: VariablesDePlantilla,
  accion?: AccionDeCorreo,
  extra?: { titulo: string; tarjetas: TarjetaDeCorreo[] },
  detalle?: DetalleDeCorreo[],
): { subject: string; html: string } {
  // El asunto se rellena sin escapar y luego se limpia: no es HTML, y un `&amp;` en la bandeja
  // de entrada se lee como el error que es.
  const subject = asunto.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_todo, nombre: string) => {
    const valor = variables[nombre];
    return valor === null || valor === undefined ? '' : String(valor);
  }).replace(/\s+/g, ' ').trim();

  return { subject, html: armazonDeCorreo(subject, rellenar(cuerpo, variables), accion, extra, detalle) };
}
