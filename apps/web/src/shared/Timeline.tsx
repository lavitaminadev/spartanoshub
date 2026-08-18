import type { JSX, ReactNode } from 'react';

/** Un hecho en la línea de tiempo. */
export interface TimelineEntry {
  id: string;
  /** Momento en que ocurrió, en ISO. */
  at: string;
  title: ReactNode;
  detail?: ReactNode;
  /** Quién lo hizo. Sin valor se muestra como del sistema. */
  author?: string;
  /**
   * Distingue lo que anotó una persona de lo que registró el sistema.
   *
   * Es la separación que faltaba en el historial del CRM: las interacciones de captura y
   * calificación las escribe la automatización, y mezclarlas con las notas del equipo hacía
   * que el hilo se leyera como una conversación donde la mitad no la dijo nadie.
   */
  origin: 'user' | 'system';
  /** Color del punto, para distinguir tipos de hecho. */
  accent?: string;
}

export interface TimelineProps {
  entries: TimelineEntry[];
  emptyMessage?: string;
}

/**
 * Línea de tiempo cronológica de un registro.
 *
 * Ordena de lo más reciente a lo más antiguo, que es como se revisa el estado de algo: lo
 * primero que se quiere saber es qué pasó último.
 */
export function Timeline({ entries, emptyMessage = 'Sin actividad registrada' }: TimelineProps): JSX.Element {
  if (!entries.length) return <p className="timeline-empty">{emptyMessage}</p>;

  const ordered = [...entries].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <ol className="timeline">
      {ordered.map((entry) => (
        <li key={entry.id} className={`timeline-entry is-${entry.origin}`}>
          <span className="timeline-dot" style={entry.accent ? { background: entry.accent } : undefined} aria-hidden="true" />
          <div className="timeline-body">
            <div className="timeline-head">
              <strong>{entry.title}</strong>
              <time dateTime={entry.at}>{formatWhen(entry.at)}</time>
            </div>
            {entry.detail ? <div className="timeline-detail">{entry.detail}</div> : null}
            <small className="timeline-author">
              {entry.origin === 'system' ? 'Registrado por el sistema' : entry.author || 'Sin autor'}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Fecha legible en español de Chile.
 *
 * Devuelve el valor original si no se puede interpretar, en vez de mostrar "Invalid Date":
 * un dato raro se ve mejor que un error del navegador.
 */
function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
