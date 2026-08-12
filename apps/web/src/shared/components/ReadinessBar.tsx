/**
 * ReadinessBar — Barra de completitud/preparación con dos variantes.
 *
 * - `bar`: barra horizontal fina con porcentaje, ideal para tarjetas kanban (solicitudes, piezas).
 *   Usa `role="progressbar"` y atributos ARIA para accesibilidad.
 * - `pill`: insignia compacta de puntaje, para resúmenes generales de readiness.
 *
 * Cuando `percent` es `null` o `undefined` no renderiza nada, degradando limpiamente
 * si el backend aún no entrega ese dato.
 *
 * @example
 * <ReadinessBar percent={83} variant="bar" label="Información" />
 * <ReadinessBar percent={92} variant="pill" />
 */

import { type JSX, memo } from 'react';

export interface ReadinessBarProps {
  percent: number | null | undefined;
  label?: string;
  variant?: 'bar' | 'pill';
  className?: string;
}

export const ReadinessBar = memo(function ReadinessBar({
  percent,
  label = 'Información',
  variant = 'bar',
  className = '',
}: ReadinessBarProps): JSX.Element | null {
  if (percent == null) return null;

  const clamped = Math.max(0, Math.min(100, percent));

  if (variant === 'pill') {
    return (
      <b className={`readiness-score ${clamped >= 90 ? 'ok' : ''} ${className}`}>
        {clamped}% {label}
      </b>
    );
  }

  return (
    <div
      className={`readiness-line ${className}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <small>
        {label} {clamped}%
      </small>
      <div>
        <i style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
});
