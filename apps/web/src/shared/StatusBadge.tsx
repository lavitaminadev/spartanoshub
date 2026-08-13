/**
 * @fileoverview Insignia de estado con color para estados de entidades.
 */

import { memo, type JSX } from 'react';
import { statusLabel } from './status-labels';
import { CYCLE_COLORS } from './status-palette';

/**
 * Mapea cadenas de estado conocidas a colores de visualización.
 */
const STATUS_COLORS: Record<string, string> = {
  active: '#087e79',
  inactive: '#706a73',
  disabled: '#706a73',
  disconnected: '#706a73',
  archived: '#706a73',
  pending: '#9a5a00',
  completed: '#087e79',
  approved: '#087e79',
  rejected: '#b5332d',
  scheduled: '#1f6fb2',
  strategic: '#087e79',
  weekly: '#087e79',
  onboarding: '#7040a0',
  paused: '#9a5a00',
  error: '#b5332d',
  review: '#1f6fb2',
  draft: '#706a73',
  closed: '#1f6fb2',
  new: '#1f6fb2',
  contacted: '#9a5a00',
  meeting_scheduled: '#1f6fb2',
  quote_sent: '#7040a0',
  negotiation: '#9a5a00',
  qualified: '#7040a0',
  discarded: '#b5332d',
  converted: '#087e79',
  won: '#087e79',
  lost: '#b5332d',
  in_progress: '#1f6fb2',
  on_hold: '#9a5a00',
  // Estados de la cola de envío a Meta CAPI (meta_conversion_outbox.status).
  processed: '#087e79',
  processing: '#9a5a00',
  retry: '#9a5a00',
  failed: '#b5332d',
  expired: '#b5332d',
  // El ciclo de reserva se define en un solo lugar porque lo comparten la bandeja,
  // el CRM de contactos y esta insignia.
  ...CYCLE_COLORS,
};

/**
 * Props de la insignia de estado.
 */
export interface StatusBadgeProps {
  /** Valor de estado interno (p. ej. `in_progress`). */
  status: string;
}

/**
 * Renderiza una píldora de estado legible con un color derivado del estado.
 */
export const StatusBadge = memo(function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  const color = STATUS_COLORS[status] || '#666';
  return (
    <span
      className="status-badge"
      style={{ backgroundColor: `${color}20`, color, borderColor: color }}
    >
      {statusLabel(status)}
    </span>
  );
});
