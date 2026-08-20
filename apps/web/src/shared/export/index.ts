/**
 * @fileoverview Punto de entrada de la exportación.
 *
 * Las pantallas importan de acá y no de los archivos internos: así cambiar cómo se genera un PDF
 * no obliga a tocar cada pantalla que exporta.
 */

export { ExportButtons } from './ExportButtons';
export { downloadCsv, buildCsv } from './to-csv';
export { openPdf } from './to-pdf';
export { fileNameWithDate, rowToCells } from './document';
export type { ExportDocument, ExportColumn, ExportMeta } from './document';
