import type { ReactNode } from 'react';
import { estaProtegido } from '@espartanos/shared';
import { TEXTO_PROTEGIDO, useRevelarProtegidos } from './datos-protegidos';

/**
 * Un dato que el servidor no mandó.
 *
 * Dice «Protegido» y no queda vacío: vacío se lee como «no lo dejó». Con `sePuedePedir` ofrece
 * «Ver», y quien lo pulsa queda anotado en el servidor; sin él no hay forma de pedirlo.
 */
export function ValorProtegido({ sePuedePedir, pendiente, onVer }: { sePuedePedir: boolean; pendiente: boolean; onVer: () => void }) {
  return <>
    <strong>{TEXTO_PROTEGIDO}</strong>
    {sePuedePedir && <button type="button" className="link-button" disabled={pendiente} onClick={onVer} title="Queda anotado quién lo vio y cuándo.">
      {pendiente ? 'Abriendo…' : 'Ver'}
    </button>}
  </>;
}

interface Props {
  /** Lo que llegó en la fila: el dato, vacío, o la marca de protegido. */
  valor: unknown;
  /** La propiedad que se pide al revelar. */
  campo: string;
  /** Dónde se piden los datos protegidos del registro. */
  ruta: string;
  sePuedePedir: boolean;
  /** Cómo se pinta el dato cuando está a la vista. Por omisión, tal cual. */
  render?: (valor: string) => ReactNode;
  /** Qué se dice cuando la persona no dejó el dato. */
  vacio?: ReactNode;
}

/**
 * Un campo de una fila que puede venir protegido.
 *
 * Con el dato a la vista lo pinta; vacío, dice `vacio`; protegido, dice «Protegido» y, si se
 * puede pedir, ofrece «Ver». Al verlo muestra el dato en la misma celda.
 */
export function CampoProtegido({ valor, campo, ruta, sePuedePedir, render, vacio = '—' }: Props) {
  const { datos, ver, pendiente, error } = useRevelarProtegidos(ruta);
  const mostrado = datos ? datos[campo] : valor;
  if (estaProtegido(mostrado)) {
    return <span className="campo-protegido">
      <ValorProtegido sePuedePedir={sePuedePedir} pendiente={pendiente} onVer={ver} />
      {error && <small className="error-text"> No se pudo abrir: {error.message}</small>}
    </span>;
  }
  if (mostrado === null || mostrado === undefined || mostrado === '') return <>{vacio}</>;
  return <>{render ? render(String(mostrado)) : String(mostrado)}</>;
}
