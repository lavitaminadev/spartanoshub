/**
 * @fileoverview Elegir un degradado con dos colores y una dirección, sin escribir CSS.
 *
 * Produce el mismo texto `linear-gradient(...)` que ya se guardaba, así las páginas públicas y el
 * servidor no cambian. Un degradado escrito a mano que no calza con dos colores se conserva tal
 * cual hasta que alguien elige colores nuevos.
 */

import type { JSX } from 'react';

export interface DegradadoSimple { desde: string; hasta: string; angulo: number }

const HEX = /#[0-9a-f]{6}\b/gi;

/** Texto CSS de un degradado de dos colores. */
export function degradadoCss({ desde, hasta, angulo }: DegradadoSimple): string {
  return `linear-gradient(${angulo}deg, ${desde} 0%, ${hasta} 100%)`;
}

/**
 * Lee un degradado guardado. Devuelve `null` si no es un degradado lineal simple de dos colores
 * hexadecimales (por ejemplo, uno con tres colores o con `rgba`).
 */
export function leerDegradado(css: string | undefined | null): DegradadoSimple | null {
  if (!css) return null;
  const texto = css.trim();
  const m = texto.match(/^linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg\s*,(.*)\)$/i);
  if (!m) return null;
  const colores = m[2].match(HEX) ?? [];
  const partes = m[2].split(',').map((parte) => parte.trim()).filter(Boolean);
  if (colores.length !== 2 || partes.length !== 2) return null;
  return { angulo: Math.round(Number(m[1])), desde: colores[0].toLowerCase(), hasta: colores[1].toLowerCase() };
}

const DIRECCIONES: Array<[number, string]> = [
  [180, 'De arriba hacia abajo'],
  [90, 'De izquierda a derecha'],
  [135, 'Diagonal'],
  [45, 'Diagonal inversa'],
];

const MUESTRAS: Array<[string, string]> = [
  ['#f4f5f7', '#d8f3f0'],
  ['#fff4ea', '#ffe1ec'],
  ['#eef2ff', '#e0f7fa'],
  ['#151317', '#30272c'],
];

export function SelectorDeDegradado({ valor, alCambiar, predeterminado }: {
  valor: string | undefined;
  alCambiar: (css: string) => void;
  /** Degradado de partida si no hay uno guardado o no se puede leer. */
  predeterminado: DegradadoSimple;
}): JSX.Element {
  const leido = leerDegradado(valor);
  const personalizado = Boolean(valor) && !leido;
  const actual = leido ?? predeterminado;
  const cambiar = (parche: Partial<DegradadoSimple>) => alCambiar(degradadoCss({ ...actual, ...parche }));
  // Una dirección guardada fuera de la lista se muestra igual, para no cambiarla al abrir.
  const direcciones = DIRECCIONES.some(([grados]) => grados === actual.angulo) ? DIRECCIONES : [...DIRECCIONES, [actual.angulo, `${actual.angulo}°`] as [number, string]];

  return (
    <div className="selector-degradado">
      {personalizado && <p className="selector-degradado-aviso">Esta sucursal tiene un degradado personalizado. Se mantiene igual hasta que elijas colores aquí.</p>}
      <div className="selector-degradado-colores">
        <label>Desde<input type="color" value={actual.desde} onChange={(e) => cambiar({ desde: e.target.value })} /></label>
        <label>Hasta<input type="color" value={actual.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} /></label>
        <label className="selector-degradado-direccion">Dirección
          <select className="input" value={actual.angulo} onChange={(e) => cambiar({ angulo: Number(e.target.value) })}>
            {direcciones.map(([grados, nombre]) => <option key={grados} value={grados}>{nombre}</option>)}
          </select>
        </label>
      </div>
      <div className="selector-degradado-muestras" role="group" aria-label="Combinaciones sugeridas">
        {MUESTRAS.map(([desde, hasta]) => (
          <button key={desde + hasta} type="button" aria-label={`Degradado de ${desde} a ${hasta}`} style={{ background: `linear-gradient(135deg, ${desde}, ${hasta})` }} onClick={() => cambiar({ desde, hasta })} />
        ))}
        <span className="selector-degradado-vista" aria-hidden="true" style={{ background: valor || degradadoCss(actual) }} />
      </div>
    </div>
  );
}
