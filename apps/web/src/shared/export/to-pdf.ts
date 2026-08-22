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
/**
 * Colores de marca.
 *
 * Estaban en un verde que venía de la herramienta que se tomó como referencia, así que el archivo
 * que se manda a un cliente no se parecía al resto del sistema. Un documento exportado circula
 * fuera de la pantalla —se reenvía, se imprime, se adjunta— y es de las pocas cosas que el
 * cliente ve con el membrete de la agencia.
 */
const ROSA = '#ec0b61';
const CIAN = '#0fb9b1';
const TINTA = '#151317';
const GRIS = '#706a73';
const LINEA = '#e7e1e5';

const ESTILOS = `
  @page { size: A4; margin: 1.5cm 1.4cm 1.8cm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: ${TINTA};
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 10pt; line-height: 1.45;
  }

  /* Banda de marca: identifica el documento antes de leer una palabra. */
  .banda { height: 4px; background: linear-gradient(90deg, ${ROSA}, ${CIAN}); border-radius: 2px; }

  header { padding: 14px 0 12px; margin-bottom: 16px; border-bottom: 1px solid ${LINEA}; }
  .marca {
    font-size: 7.5pt; letter-spacing: .18em; text-transform: uppercase;
    color: ${GRIS}; margin-bottom: 6px;
  }
  h1 { margin: 0; font-size: 18pt; letter-spacing: -.015em; font-weight: 700; }
  .subtitulo { margin: 4px 0 0; color: ${GRIS}; font-size: 9.5pt; }

  /*
   * El contexto va arriba y en tarjetas.
   *
   * El archivo se lee semanas después y fuera de la pantalla que lo generó: sin el filtro
   * anotado, nadie sabe si son todas las filas o solo las de un cliente.
   */
  .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .meta div {
    padding: 6px 10px; border: 1px solid ${LINEA}; border-radius: 6px;
    background: #fbfafb; min-width: 110px;
  }
  .meta span {
    display: block; color: ${GRIS}; text-transform: uppercase;
    letter-spacing: .08em; font-size: 6.5pt; margin-bottom: 2px;
  }
  .meta b { font-weight: 600; font-size: 9pt; }

  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th {
    padding: 8px 8px; text-align: left; background: #faf7f9;
    border-bottom: 1.5px solid ${ROSA};
    font-size: 7pt; text-transform: uppercase; letter-spacing: .08em; color: ${TINTA};
  }
  td { padding: 6px 8px; border-bottom: .5px solid ${LINEA}; vertical-align: top; }
  tr { page-break-inside: avoid; }
  /* Filas alternas sin líneas verticales: las verticales ensucian al imprimir. */
  tbody tr:nth-child(even) { background: #fbfafb; }
  .der { text-align: right; font-variant-numeric: tabular-nums; }

  footer {
    margin-top: 18px; padding-top: 9px; border-top: 1px solid ${LINEA};
    color: ${GRIS}; font-size: 7.5pt;
    display: flex; justify-content: space-between; gap: 16px;
  }
  .vacio { padding: 28px; text-align: center; color: ${GRIS}; }
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

  const registros = documento.rows.length === 1 ? '1 registro' : `${documento.rows.length} registros`;

  ventana.document.write(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escaparHtml(documento.fileName)}</title><style>${ESTILOS}</style></head>
<body>
  <div class="banda"></div>
  <header>
    <div class="marca">${escaparHtml(documento.footer ?? 'Espartanos')}</div>
    <h1>${escaparHtml(documento.title)}</h1>
    ${documento.subtitle ? `<p class="subtitulo">${escaparHtml(documento.subtitle)}</p>` : ''}
    ${meta ? `<div class="meta">${meta}</div>` : ''}
  </header>
  <table><thead><tr>${encabezados}</tr></thead><tbody>${filas}</tbody></table>
  <footer>
    <span>${escaparHtml(registros)}</span>
    <span>Generado el ${escaparHtml(generado)}</span>
  </footer>
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
