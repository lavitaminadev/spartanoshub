/**
 * @fileoverview Los dos botones de descarga, con el mismo documento detrás.
 *
 * Reciben un `ExportDocument` y no una tabla ya armada: así el CSV y el PDF describen exactamente
 * las mismas columnas, y agregar una a la exportación la agrega a los dos formatos a la vez.
 */

import { useState, type JSX } from 'react';
import { downloadCsv } from './to-csv';
import { openPdf } from './to-pdf';
import type { ExportDocument } from './document';
import './export-buttons.css';

interface Props<T> {
  document: ExportDocument<T>;
  /** Oculta el CSV cuando el documento es para lectura o impresión, no para reprocesar datos. */
  csv?: boolean;
  /** Oculta el PDF donde no aporta, por ejemplo en una lista que solo se lleva a una planilla. */
  pdf?: boolean;
}

export function ExportButtons<T>({ document, csv = true, pdf = true }: Props<T>): JSX.Element {
  const [aviso, setAviso] = useState<string | null>(null);
  const vacio = document.rows.length === 0;

  return (
    <div className="export-botones">
      {csv ? <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={vacio}
        // Sin filas el archivo saldría con encabezados y nada más, y quien lo abre cree que se
        // perdieron los datos en vez de entender que el filtro no encontró ninguno.
        title={vacio ? 'No hay filas que exportar' : 'Descargar como CSV'}
        onClick={() => downloadCsv(document)}
      >
        Exportar CSV
      </button> : null}

      {pdf ? (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={vacio}
          title={vacio ? 'No hay filas que exportar' : 'Abrir para imprimir o guardar como PDF'}
          onClick={() => setAviso(openPdf(document) ? null : 'El navegador bloqueó la ventana. Permite las ventanas emergentes de este sitio.')}
        >
          Descargar PDF
        </button>
      ) : null}

      {/* El bloqueo de ventanas es silencioso: sin este aviso el botón parece muerto. */}
      {aviso ? <span className="export-aviso" role="alert">{aviso}</span> : null}
    </div>
  );
}
