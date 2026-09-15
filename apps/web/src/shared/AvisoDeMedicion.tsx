/**
 * @fileoverview Aviso de medición al entrar y enlace permanente para cambiar la elección.
 *
 * Se pregunta una vez por página en ese navegador. «Preferencias de medición» queda siempre en el
 * pie para volver a elegir: retirar tiene que ser tan fácil como aceptar.
 */

import { useState, type JSX } from 'react';
import { AVISO_MEDICION, TEXTO_MEDICION } from '@espartanos/shared';

export function AvisoDeMedicion({ abierto, aceptada, onElegir, onCerrar }: {
  abierto: boolean;
  aceptada: boolean;
  onElegir: (acepta: boolean) => void;
  /** Cerrar sin cambiar la elección, cuando se abrió desde «Preferencias de medición». */
  onCerrar?: () => void;
}): JSX.Element | null {
  const [detalle, setDetalle] = useState(false);
  if (!abierto) return null;
  return (
    <div className="booking-medicion-aviso aviso-medicion" role="region" aria-label="Preferencias de medición">
      <p><strong>¿Nos ayudas a medir esta página?</strong> {AVISO_MEDICION}</p>
      <button type="button" className="enlace aviso-medicion-detalle" aria-expanded={detalle} onClick={() => setDetalle(!detalle)}>{detalle ? 'Ocultar detalle' : 'Ver detalle'}</button>
      {detalle && <p className="aviso-medicion-texto">{TEXTO_MEDICION}</p>}
      <div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => onElegir(false)}>{aceptada ? 'Retirar permiso' : 'No, gracias'}</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onElegir(true)}>{aceptada ? 'Mantener' : 'Aceptar'}</button>
        {onCerrar && <button type="button" className="enlace" onClick={onCerrar}>Cerrar</button>}
      </div>
    </div>
  );
}

/** Enlace del pie para volver a abrir el aviso. */
export function EnlacePreferenciasDeMedicion({ aceptada, onAbrir }: { aceptada: boolean; onAbrir: () => void }): JSX.Element {
  return (
    <p className="preferencias-medicion">
      Medición publicitaria: <strong>{aceptada ? 'aceptada' : 'no aceptada'}</strong> · <button type="button" className="enlace" onClick={onAbrir}>Preferencias de medición</button>
    </p>
  );
}
