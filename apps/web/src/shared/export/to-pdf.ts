/**
 * @fileoverview Genera el PDF de un documento exportable.
 *
 * **Sin librería de PDF, a propósito.** `jspdf` con su tabla suma cerca de 400 KB al paquete, y
 * generar el archivo en el servidor exigiría un motor de render en una cuenta con 768 MB para
 * todos los procesos. La imprenta del navegador ya sabe paginar, numerar y exportar a PDF; lo que
 * falta es darle una hoja bien maquetada.
 *
 * Se abre una ventana aparte en vez de imprimir la página actual: imprimir la actual arrastraría
 * el menú, los filtros y los botones, y obligaría a mantener reglas `@media print` en cada
 * pantalla que quiera exportar.
 */

import { rowToCells, type ExportDocument } from './document';

/** Escapa el texto que se inserta en el HTML de la hoja. */
function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Hoja de estilos del documento impreso.
 *
 * `@page` fija el margen en centímetros porque es la unidad del papel, no del navegador.
 * `thead` se repite en cada página —`display: table-header-group`— para que la segunda hoja no
 * llegue con columnas sin nombre. Y ninguna fila se parte a la mitad, que es lo que hace ilegible
 * una tabla larga impresa.
 */
const ESTILOS = `
  @page { size: A4; margin: 1.6cm 1.4cm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: #14161c;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 10pt; line-height: 1.45;
  }
  header { border-bottom: 2px solid #17c78a; padding-bottom: 10px; margin-bottom: 14px; }
  h1 { margin: 0; font-size: 16pt; letter-spacing: -.01em; }
  .subtitulo { margin: 3px 0 0; color: #5a6470; font-size: 9.5pt; }

  /* El contexto va arriba: el archivo se lee fuera de la pantalla que lo generó. */
  .meta { display: flex; flex-wrap: wrap; gap: 4px 22px; margin-top: 9px; }
  .meta div { font-size: 8.5pt; }
  .meta span { color: #7a838d; text-transform: uppercase; letter-spacing: .06em; font-size: 7.5pt; }
  .meta b { display: block; font-weight: 600; }

  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th {
    padding: 6px 7px; text-align: left; border-bottom: 1.5px solid #14161c;
    font-size: 7.5pt; text-transform: uppercase; letter-spacing: .07em; color: #4a545e;
  }
  td { padding: 5px 7px; border-bottom: .5px solid #d8dde1; vertical-align: top; }
  tr { page-break-inside: avoid; }
  /* Las filas alternas se distinguen sin líneas verticales, que ensucian al imprimir. */
  tbody tr:nth-child(even) { background: #f5f7f8; }
  .der { text-align: right; font-variant-numeric: tabular-nums; }

  footer { margin-top: 16px; padding-top: 8px; border-top: .5px solid #d8dde1; color: #7a838d; font-size: 8pt; }
  .vacio { padding: 24px; text-align: center; color: #7a838d; }
`;

/**
 * Abre la hoja lista para imprimir o guardar como PDF.
 *
 * @returns `false` si el navegador bloqueó la ventana, para que la pantalla pueda avisarlo en vez
 *   de quedarse en silencio: sin ventana no hay descarga, y no se distingue de un botón muerto.
 */
export function openPdf<T>(documento: ExportDocument<T>): boolean {
  const ventana = window.open('', '_blank', 'width=900,height=700');
  if (!ventana) return false;

  const encabezados = documento.columns
    .map((columna) => {
      const ancho = columna.width ? ` style="width:${columna.width}%"` : '';
      return `<th class="${columna.align === 'right' ? 'der' : ''}"${ancho}>${escaparHtml(columna.header)}</th>`;
    })
    .join('');

  const filas = documento.rows.length
    ? documento.rows.map((fila) => {
      const celdas = rowToCells(documento, fila)
        .map((celda, indice) => `<td class="${documento.columns[indice]?.align === 'right' ? 'der' : ''}">${escaparHtml(celda)}</td>`)
        .join('');
      return `<tr>${celdas}</tr>`;
    }).join('')
    : `<tr><td class="vacio" colspan="${documento.columns.length}">Sin datos para el filtro aplicado.</td></tr>`;

  const meta = (documento.meta ?? [])
    .map((dato) => `<div><span>${escaparHtml(dato.label)}</span><b>${escaparHtml(dato.value)}</b></div>`)
    .join('');

  const generado = new Date().toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' });

  ventana.document.write(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escaparHtml(documento.fileName)}</title><style>${ESTILOS}</style></head>
<body>
  <header>
    <h1>${escaparHtml(documento.title)}</h1>
    ${documento.subtitle ? `<p class="subtitulo">${escaparHtml(documento.subtitle)}</p>` : ''}
    ${meta ? `<div class="meta">${meta}</div>` : ''}
  </header>
  <table><thead><tr>${encabezados}</tr></thead><tbody>${filas}</tbody></table>
  <footer>${escaparHtml(documento.footer ?? '')}${documento.footer ? ' · ' : ''}Generado el ${escaparHtml(generado)} · ${documento.rows.length} registro(s)</footer>
</body></html>`);
  ventana.document.close();

  // Se espera a que la hoja termine de maquetarse: llamar a imprimir antes deja la primera página
  // en blanco en algunos navegadores.
  ventana.onload = () => {
    ventana.focus();
    ventana.print();
  };
  return true;
}
