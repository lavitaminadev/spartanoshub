/**
 * @fileoverview Genera el CSV de un documento exportable.
 *
 * Un CSV se abre casi siempre en Excel, y Excel es exigente de maneras poco obvias. Cada decisión
 * de acá corrige un fallo concreto que se ve al abrir el archivo, no una preferencia.
 */

import { fileNameWithDate, rowToCells, type ExportDocument } from './document';

/**
 * Escapa una celda.
 *
 * Se entrecomilla si contiene el separador, comillas o un salto de línea; sin eso, un nombre con
 * coma parte la fila en dos columnas y desplaza todo lo que sigue. Las comillas internas se
 * duplican, que es como el formato las representa.
 *
 * Se antepone un apóstrofo a lo que empieza por `=`, `+`, `-` o `@`: Excel interpreta esas celdas
 * como fórmulas, y un teléfono guardado como `+56912345678` se ejecuta en vez de mostrarse. Con
 * datos que vienen de un formulario público, además, es la vía por la que alguien podría dejar
 * una fórmula lista para ejecutarse en el equipo de quien abra el archivo.
 */
function escapar(valor: string): string {
  const protegido = /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
  return /[",;\n\r]/.test(protegido) ? `"${protegido.replace(/"/g, '""')}"` : protegido;
}

/**
 * Arma el contenido del CSV.
 *
 * El separador es punto y coma y no coma: Excel en español espera punto y coma, y con coma abre
 * todo el archivo apilado en una sola columna. Los saltos son `\r\n` por la misma razón.
 *
 * El contexto va arriba, antes de los encabezados: un archivo se lee semanas después y sin el
 * filtro anotado nadie sabe si son todas las filas o solo las de un cliente.
 */
export function buildCsv<T>(document: ExportDocument<T>): string {
  const lineas: string[] = [escapar(document.title)];

  if (document.subtitle) lineas.push(escapar(document.subtitle));
  for (const dato of document.meta ?? []) lineas.push(`${escapar(dato.label)};${escapar(dato.value)}`);
  // Cuándo se generó. Un archivo sin fecha no se puede comparar con otro del mismo nombre, que es
  // exactamente lo que pasa cuando alguien exporta lo mismo dos semanas seguidas.
  lineas.push(`${escapar('Generado')};${escapar(new Date().toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' }))}`);
  if (lineas.length > 1) lineas.push('');

  lineas.push(document.columns.map((columna) => escapar(columna.header)).join(';'));
  for (const fila of document.rows) {
    lineas.push(rowToCells(document, fila).map(escapar).join(';'));
  }

  return lineas.join('\r\n');
}

/**
 * Descarga el CSV.
 *
 * Lleva marca de orden de bytes al inicio. Sin ella Excel abre el archivo en su codificación
 * local y los acentos y la eñe aparecen rotos, que es el primer reclamo de cualquier exportación
 * en español.
 */
export function downloadCsv<T>(document: ExportDocument<T>): void {
  const blob = new Blob([`﻿${buildCsv(document)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = window.document.createElement('a');
  enlace.href = url;
  enlace.download = fileNameWithDate(document.fileName, 'csv');
  enlace.click();
  // Sin esto el blob queda en memoria hasta recargar, y son varios megas por exportación.
  URL.revokeObjectURL(url);
}
