/**
 * @fileoverview Preguntar antes de lo que no tiene vuelta atrás.
 *
 * En el sistema conviven tres formas de confirmar: un componente propio para borrar registros,
 * un `Modal` escrito a mano en cada pantalla, y acciones que no preguntan nada. La consecuencia
 * no es estética: cada una decide por su cuenta **qué se le cuenta a quien va a pulsar**, así que
 * borrar una campaña avisa de una cosa y rotar una llave de otra, cuando las dos dejan algo sin
 * funcionar.
 *
 * Esto unifica el patrón. Lo que aporta sobre un `confirm()` del navegador es la pieza que
 * importa: **la consecuencia**.
 *
 *     Mal:  «¿Seguro que quieres quitar esta campaña?»
 *     Bien: «Se borra la campaña y su inversión. Los leads se conservan, pero su costo por
 *            lead deja de calcularse, también hacia atrás.»
 *
 * La primera pide un sí. La segunda deja decidir. Por eso `consecuencia` es obligatoria: sin
 * ella, este componente no aporta nada que no diera un diálogo del navegador.
 */

import type { JSX, ReactNode } from 'react';
import { Modal } from './Modal';

export interface ConfirmarAccionProps {
  /** Qué se va a hacer, nombrando el registro: «Quitar la campaña Verano 2026». */
  titulo: string;
  /**
   * Qué pasa después, en las palabras de quien lo va a sufrir.
   *
   * Obligatoria a propósito. Es la única razón por la que este diálogo existe.
   */
  consecuencia: ReactNode;
  /** Texto del botón que confirma. Nombra la acción: «Quitar la campaña», no «Aceptar». */
  confirmar: string;
  /** Se marca cuando la acción no se puede deshacer, para pintarla como corresponde. */
  irreversible?: boolean;
  enCurso?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmarAccion({
  titulo,
  consecuencia,
  confirmar,
  irreversible = true,
  enCurso = false,
  onConfirmar,
  onCancelar,
}: ConfirmarAccionProps): JSX.Element {
  return (
    <Modal open onClose={onCancelar} title={titulo}>
      <div className="modal-form">
        <p>{consecuencia}</p>
        {irreversible ? <p className="confirmar-irreversible">Esto no se puede deshacer.</p> : null}
        <div className="modal-actions">
          {/*
            Cancelar va primero y es el botón neutro: quien llega acá por error encuentra la
            salida en el sitio donde el ojo la busca, no al lado del botón que rompe algo.
          */}
          <button type="button" className="btn btn-outline" onClick={onCancelar} disabled={enCurso}>
            Cancelar
          </button>
          <button
            type="button"
            className={irreversible ? 'btn btn-danger' : 'btn btn-accent'}
            onClick={onConfirmar}
            disabled={enCurso}
          >
            {enCurso ? 'Aplicando...' : confirmar}
          </button>
        </div>
      </div>
    </Modal>
  );
}
