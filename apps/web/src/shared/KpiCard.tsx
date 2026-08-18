import type { JSX, ReactNode } from 'react';

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  /**
   * Variación respecto del período anterior, en porcentaje.
   *
   * Se recibe como número y no como texto ya formateado para poder decidir acá el color y el
   * signo: si cada pantalla lo formatea por su cuenta, terminan conviviendo "+12%", "12 %" y
   * "↑12" en el mismo tablero.
   */
  delta?: number;
  /**
   * Si subir es bueno.
   *
   * No siempre lo es: más tratos ganados sí, más tratos perdidos no. Sin este dato una
   * variación al alza se pintaría de verde aunque describa un empeoramiento.
   */
  higherIsBetter?: boolean;
  hint?: ReactNode;
  className?: string;
}

/**
 * Cifra de tablero con su variación.
 *
 * Complementa a `StatCard`, que muestra un valor sin comparación. Cuando hay período anterior
 * con el que comparar, esta comunica bastante más: un número solo no dice si algo va bien.
 */
export function KpiCard({ label, value, delta, higherIsBetter = true, hint, className }: KpiCardProps): JSX.Element {
  const tone = deltaTone(delta, higherIsBetter);
  return (
    <article className={['kpi-card', className].filter(Boolean).join(' ')}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {delta !== undefined && Number.isFinite(delta) ? (
        <span className={`kpi-delta is-${tone}`}>
          {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {Math.abs(delta).toFixed(1)}%
        </span>
      ) : null}
      {hint ? <small className="kpi-hint">{hint}</small> : null}
    </article>
  );
}

/** Decide el color de la variación según si subir es deseable. */
function deltaTone(delta: number | undefined, higherIsBetter: boolean): 'good' | 'bad' | 'flat' {
  if (delta === undefined || !Number.isFinite(delta) || delta === 0) return 'flat';
  const subio = delta > 0;
  return subio === higherIsBetter ? 'good' : 'bad';
}
