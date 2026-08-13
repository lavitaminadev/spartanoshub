/**
 * @fileoverview StatCard: la única tarjeta de cifra (etiqueta + valor + detalle).
 *
 * Antes este patrón `label → número grande → hint` se escribía a mano en ~80
 * lugares con estructura casi idéntica (`article > span/strong/small`) y una hoja
 * CSS distinta por variante. Este componente es el molde único; los contenedores
 * de grilla siguen aportando la piel (padding, sombra, radios) mediante `.className`.
 */

import { memo, type JSX, type ReactNode } from 'react';

export interface StatCardProps {
  /** Etiqueta corta, normalmente en mayúsculas. */
  label: string;
  /** Valor principal: número, texto o ReactNode con unidades. */
  value: ReactNode;
  /** Texto de apoyo debajo del valor. */
  hint?: ReactNode;
  /** Color alternativo para el valor. */
  color?: string;
  /** Marca la tarjeta como "requiere acción" (las grillas le dan su propio estilo). */
  attention?: boolean;
  /** Clases extra (la grilla contenedora y modificadores específicos del contexto). */
  className?: string;
}

/**
 * Renderiza una única tarjeta de cifra.
 *
 * Mantiene la estructura `article > span/strong/small`: las grillas existentes
 * (`.viz-stat-row`, `.governance-stats`, `.report-kpis`, ...) ya estilan esos
 * elementos, así que la migración no cambia la apariencia.
 */
export const StatCard = memo(function StatCard({ label, value, hint, color, attention, className }: StatCardProps): JSX.Element {
  const classes = [attention ? 'attention' : null, className].filter(Boolean).join(' ') || undefined;
  return (
    <article className={classes}>
      <span>{label}</span>
      <strong style={color ? { color } : undefined}>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
});