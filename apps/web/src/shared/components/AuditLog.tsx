/**
 * @fileoverview Lista vertical de auditoría (quién hizo qué y cuándo) para trabajos,
 * excepciones de tiempo y decisiones de aprobación. Cada entrada trae su `time` ya
 * formateado por quien la crea; `formatRelativeTime` está disponible para producir ese
 * texto ("Ahora", "Hoy, 10:42", "Ayer, 17:36") a partir de una fecha real.
 */

import type { JSX } from 'react';
import './AuditLog.css';

/** Color del punto de la línea de tiempo, ligado a las variables de marca. */
export type AuditTone = 'pink' | 'cyan' | 'amber';

/** Una entrada del historial de auditoría. */
export interface AuditEntry {
  /** Identificador estable para la key de lista; si falta, se usa el índice. */
  id?: string | number;
  /** Qué ocurrió, en pocas palabras. Ej. "Excepción de tiempo aprobada". */
  title: string;
  /** Detalle del cambio: valores anteriores/nuevos, motivo, referencia. */
  detail: string;
  /** Quién lo hizo. */
  actor: string;
  /** Momento, ya formateado (ver `formatRelativeTime`). */
  time: string;
  /** Color del punto. Por defecto "pink". */
  tone?: AuditTone;
}

/**
 * Props de la lista de auditoría.
 */
export interface AuditLogProps {
  /** Entradas a mostrar, en el orden en que deben listarse (más reciente primero). */
  entries: AuditEntry[];
  /** Mensaje mostrado cuando `entries` está vacío. */
  emptyMessage?: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Formatea una fecha como texto relativo corto, en el mismo estilo que usa el resto de la
 * auditoría de la app: "Ahora" si fue hace menos de un minuto, "Hoy, HH:mm" el mismo día,
 * "Ayer, HH:mm" el día anterior, y la fecha corta en cualquier otro caso.
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  const time = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  if (diff < MINUTE) return 'Ahora';

  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) return `Hoy, ${time}`;

  const yesterday = new Date(now.getTime() - DAY);
  if (date.toDateString() === yesterday.toDateString()) return `Ayer, ${time}`;

  return `${date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}, ${time}`;
}

/**
 * Renderiza una lista vertical de auditoría con un punto de color por entrada.
 */
export function AuditLog({ entries, emptyMessage = 'Sin actividad registrada todavía.' }: AuditLogProps): JSX.Element {
  if (entries.length === 0) {
    return <p className="audit-log-empty">{emptyMessage}</p>;
  }

  return (
    <ol className="audit-log">
      {entries.map((entry, index) => (
        <li key={entry.id ?? index} className="audit-log-item">
          <span className={`audit-log-dot audit-log-dot--${entry.tone ?? 'pink'}`} aria-hidden="true" />
          <div className="audit-log-content">
            <b>{entry.title}</b>
            <p>{entry.detail}</p>
            <small>
              {entry.actor} · {entry.time}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}
