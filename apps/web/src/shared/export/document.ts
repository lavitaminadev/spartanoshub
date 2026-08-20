/**
 * @fileoverview Esquema común de un documento exportable.
 *
 * CSV y PDF describen los mismos datos con formas distintas: uno es una tabla plana para abrir en
 * una planilla, el otro una página con encabezado y pie para imprimir o mandar. Sin un esquema
 * único, cada pantalla termina armando dos veces la misma lista y las dos versiones divergen: se
 * agrega una columna al CSV y el PDF sigue con las de antes.
 *
 * Acá se declara **qué** se exporta; `to-csv.ts` y `to-pdf.ts` deciden **cómo** se ve en cada
 * formato.
 */

/** Una columna del documento. */
export interface ExportColumn<T> {
  /** Encabezado, tal como se lee en el archivo. */
  header: string;
  /**
   * Valor de la celda.
   *
   * Devuelve texto ya formateado y no el dato crudo: la fecha, el monto y el porcentaje se ven
   * como en pantalla, que es lo que quien recibe el archivo espera reconocer.
   */
  value: (row: T) => string | number | null | undefined;
  /**
   * Alineación en el PDF. El CSV no la usa: la planilla alinea según el tipo que detecta.
   *
   * Los números van a la derecha porque así se comparan de un vistazo al leer una columna.
   */
  align?: 'left' | 'right';
  /** Ancho relativo en el PDF, para que una columna de nombres no quede igual que una de conteos. */
  width?: number;
}

/** Un dato del encabezado: período, filtro aplicado, total. */
export interface ExportMeta {
  label: string;
  value: string;
}

/**
 * Documento listo para exportar.
 *
 * @template T - Tipo de cada fila.
 */
export interface ExportDocument<T> {
  /** Nombre del archivo, sin extensión. Se limpia al descargar. */
  fileName: string;
  /** Título en la primera línea del PDF. */
  title: string;
  /** Aclaración bajo el título: qué contiene y de qué período. */
  subtitle?: string;
  /**
   * Contexto del documento: filtros aplicados, rango, totales.
   *
   * Importa más de lo que parece: un archivo exportado se lee semanas después, fuera de la
   * pantalla que lo generó, y sin el filtro anotado nadie puede saber si esas son todas las filas
   * o solo las de un cliente.
   */
  meta?: ExportMeta[];
  columns: ExportColumn<T>[];
  rows: T[];
  /** Aparece al pie de cada página del PDF. */
  footer?: string;
}

/**
 * Convierte una fila a texto por columna.
 *
 * Un valor ausente se vuelve cadena vacía y no «null» ni «undefined»: esas palabras aparecen
 * impresas en la celda y quien abre el archivo las lee como si fueran un dato.
 */
export function rowToCells<T>(document: ExportDocument<T>, row: T): string[] {
  return document.columns.map((column) => {
    const valor = column.value(row);
    return valor === null || valor === undefined ? '' : String(valor);
  });
}

/**
 * Nombre de archivo seguro, con la fecha del día.
 *
 * Se le agrega la fecha porque estos archivos se descargan repetidamente y sin ella el navegador
 * los numera `(1)`, `(2)`, dejando una carpeta donde no se sabe cuál es de cuándo.
 */
export function fileNameWithDate(base: string, extension: string): string {
  const limpio = base.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'export';
  const hoy = new Date().toISOString().slice(0, 10);
  return `${limpio}-${hoy}.${extension}`;
}
