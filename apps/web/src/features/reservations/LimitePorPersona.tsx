/**
 * @fileoverview Cuántas veces puede usar un cupón la misma persona, y cómo se la reconoce.
 *
 * Un cupón sólo tenía un total de usos: uno de cien usos lo podía gastar entero una sola persona.
 * Aquí se elige el tope por persona y con qué datos se la reconoce —teléfono, correo, documento—.
 * Basta con que coincida cualquiera de los elegidos, así que cambiar uno solo no sirve para
 * saltarse el límite.
 *
 * La pantalla explica en una frase lo que va a pasar y avisa de las combinaciones que no
 * limitarían a nadie, antes de que se guarde un cupón que parece protegido y no lo está.
 */

import type { JSX } from 'react';

export type ClaveDePersona = 'phone' | 'email' | 'document';

export interface LimiteDePersona {
  maxUsesPerPerson: number;
  personKeys: ClaveDePersona[];
}

const OPCIONES: Array<{ clave: ClaveDePersona; titulo: string; explica: string; recomendado?: boolean }> = [
  { clave: 'phone', titulo: 'Teléfono', explica: 'Todos los formularios lo piden. Es el más difícil de cambiar.', recomendado: true },
  { clave: 'email', titulo: 'Correo', explica: 'Sólo cuenta si la persona lo dejó: en los formularios suele ser opcional.' },
  { clave: 'document', titulo: 'Documento de identidad', explica: 'RUT o pasaporte. El más fuerte, pero sólo sirve en locales que lo piden.' },
];

const NOMBRES: Record<ClaveDePersona, string> = { phone: 'su teléfono', email: 'su correo', document: 'su documento' };

/** Une «a», «a o b», «a, b o c». */
function enLista(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} o ${partes[partes.length - 1]}`;
}

/** Si el límite está bien definido. Sin ninguna forma de reconocer a la persona no limita nada. */
export function limiteValido(limite: LimiteDePersona): boolean {
  return limite.maxUsesPerPerson === 0 || limite.personKeys.length > 0;
}

export function LimitePorPersona({ valor, onChange, empresa, algunLocalPideDocumento }: {
  valor: LimiteDePersona;
  onChange: (valor: LimiteDePersona) => void;
  empresa: string;
  /** Si algún formulario de la empresa pide documento: si no, marcarlo no bloquea a nadie. */
  algunLocalPideDocumento: boolean;
}): JSX.Element {
  const limita = valor.maxUsesPerPerson > 0;
  const claves = valor.personKeys;
  const veces = valor.maxUsesPerPerson === 1 ? '1 vez' : `${valor.maxUsesPerPerson} veces`;
  const alternar = (clave: ClaveDePersona) => onChange({
    ...valor,
    personKeys: claves.includes(clave) ? claves.filter((otra) => otra !== clave) : [...claves, clave],
  });

  return (
    <fieldset className="limite-por-persona">
      <legend>Límite por persona</legend>
      <small>Cuántas veces puede usar este cupón la misma persona en los locales de {empresa}. En otras empresas no cuenta.</small>

      <div className="limite-por-persona-modo" role="radiogroup" aria-label="Límite por persona">
        <label className={!limita ? 'activo' : ''}>
          <input type="radio" checked={!limita} onChange={() => onChange({ ...valor, maxUsesPerPerson: 0 })} /> Sin límite
        </label>
        <label className={limita ? 'activo' : ''}>
          <input type="radio" checked={limita} onChange={() => onChange({ maxUsesPerPerson: valor.maxUsesPerPerson || 1, personKeys: claves.length ? claves : ['phone', 'email'] })} /> Limitar
        </label>
      </div>

      {limita && <>
        <label className="limite-por-persona-veces">
          Usos por persona
          <input className="input" type="number" min={1} max={100} value={valor.maxUsesPerPerson} onChange={(event) => onChange({ ...valor, maxUsesPerPerson: Math.min(100, Math.max(1, Number(event.target.value) || 1)) })} />
        </label>

        <p className="limite-por-persona-pregunta">¿Cómo reconocemos que es la misma persona? Marca uno o varios.</p>
        {OPCIONES.map((opcion) => (
          <label key={opcion.clave} className={`limite-por-persona-opcion ${claves.includes(opcion.clave) ? 'activa' : ''}`}>
            <input type="checkbox" checked={claves.includes(opcion.clave)} onChange={() => alternar(opcion.clave)} />
            <span>
              <strong>{opcion.titulo}</strong>{opcion.recomendado && <em className="limite-por-persona-recomendado">recomendado</em>}
              <small>{opcion.explica}</small>
            </span>
          </label>
        ))}

        {claves.length === 0 && <p className="field-error" role="alert">Marca al menos una forma de reconocer a la persona.</p>}
        {claves.length === 1 && claves[0] === 'email' && <p className="alert alert-warning">Sólo con correo, quien reserve sin dejar correo no tendrá límite. Suma el teléfono.</p>}
        {claves.includes('document') && !algunLocalPideDocumento && <p className="alert alert-warning">Ningún local de {empresa} pide documento hoy: este criterio no bloqueará a nadie hasta que agregues el campo «Documento de identidad» al formulario.</p>}
      </>}

      <p className="limite-por-persona-resumen">
        {!limita
          ? 'Cualquier persona puede usarlo las veces que quiera, hasta agotar los usos totales del cupón.'
          : claves.length
            ? `Cada persona puede usarlo ${veces} en los locales de ${empresa}. Es la misma persona si coincide ${enLista(claves.map((clave) => NOMBRES[clave]))}.`
            : 'Falta elegir cómo reconocer a la persona.'}
      </p>
    </fieldset>
  );
}
