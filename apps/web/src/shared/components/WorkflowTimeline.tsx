/**
 * @fileoverview Grilla horizontal de etapas de un flujo de trabajo (ej. las 13 etapas
 * audiovisuales del prototipo), con la etapa actual resaltada y un botón opcional para
 * avanzar a la siguiente.
 *
 * Usa el namespace `wf-timeline` en vez de `.workflow-strip` (nombre del prototipo) porque
 * `styles/notifications-users.css` ya define `.workflow-strip` para un patrón visual distinto
 * (lista de canales configurados). Como el CSS de la app es global — no hay CSS Modules —
 * reutilizar ese nombre pisaría esa pantalla en vez de solo inspirarse en su diseño.
 */

import type { JSX } from 'react';
import './WorkflowTimeline.css';

/** Estado visual de una etapa dentro de la línea de trabajo. */
export type WorkflowStageStatus = 'done' | 'current' | 'pending';

/** Una etapa del flujo, con su responsable y estado. */
export interface WorkflowStage {
  /** Nombre de la etapa, ej. "Grabación". */
  name: string;
  /** Responsable o rol a cargo de la etapa, ej. "Diego V." */
  owner: string;
  /** Estado visual: completada, en curso o pendiente. */
  status: WorkflowStageStatus;
}

/**
 * Props de la línea de tiempo de flujo de trabajo.
 */
export interface WorkflowTimelineProps {
  /** Etapas del flujo, en orden. */
  stages: WorkflowStage[];
  /** Índice (base 0) de la etapa actual, usado para el foco/aria del control de avance. */
  currentStage: number;
  /** Si se entrega, muestra un botón para avanzar a la siguiente etapa. */
  onAdvance?: () => void;
}

const STATUS_LABEL: Record<WorkflowStageStatus, string> = {
  done: 'Completada',
  current: 'En curso',
  pending: 'Pendiente',
};

/**
 * Renderiza las etapas de un flujo como tarjetas horizontales navegables con teclado
 * (contenedor con scroll) y, opcionalmente, un botón para avanzar a la siguiente etapa.
 */
export function WorkflowTimeline({ stages, currentStage, onAdvance }: WorkflowTimelineProps): JSX.Element {
  const next = stages[currentStage + 1];

  return (
    <div className="wf-timeline-wrap">
      <ol className="wf-timeline" aria-label="Etapas del flujo de trabajo">
        {stages.map((stage, index) => (
          <li key={`${stage.name}-${index}`} className={`wf-timeline-stage wf-timeline-stage--${stage.status}`}>
            <span className="wf-timeline-index" aria-hidden="true">
              {stage.status === 'done' ? '✓' : index + 1}
            </span>
            <b className="wf-timeline-name">{stage.name}</b>
            <small className="wf-timeline-owner">{stage.owner}</small>
            <span className="wf-timeline-sr-status">{STATUS_LABEL[stage.status]}</span>
          </li>
        ))}
      </ol>
      {onAdvance && (
        <button
          type="button"
          className="btn btn-primary btn-sm wf-timeline-advance"
          onClick={onAdvance}
          disabled={!next}
        >
          {next ? `Avanzar a ${next.name}` : 'Flujo completado'}
        </button>
      )}
    </div>
  );
}
