/**
 * @fileoverview La pregunta que decide qué aprende la pauta: ¿era el tipo de cliente que busco?
 *
 * Es un componente y no tres copias porque se hace en tres sitios —al descartar uno, al descartar
 * en lote y al mover a una etapa configurada— y las tres tienen que preguntar exactamente lo
 * mismo. Cuando la redacción difiere, las respuestas dejan de ser comparables entre sí y el dato
 * que sale no se puede sumar.
 *
 * **Está redactada por su consecuencia, no por el concepto.** «¿Está calificado?» no significa
 * nada para quien cierra una ficha; «¿quieres que lleguen más como ella?» se responde solo. Lo
 * que se guarda es la calificación, pero eso es asunto del sistema, no de quien contesta.
 */

import type { JSX } from 'react';
import { CALIFICACION_SEGUN_SERVIA, type ServiaElProspecto } from '@espartanos/shared';

/** Qué se le enviará a Meta con cada respuesta, dicho tal como se llama el evento. */
const CONSECUENCIA: Record<ServiaElProspecto, string> = {
  si: 'Se enviará «Calificado» a Meta para que busque más personas así.',
  no: 'Se enviará «Descartado» a Meta.',
  nose: 'No se enviará nada a Meta: no se afirma lo que nadie comprobó.',
};

const OPCIONES: Array<{ valor: ServiaElProspecto; titulo: string; ayuda: string }> = [
  { valor: 'si', titulo: 'Sí', ayuda: 'Era el tipo de cliente que busco' },
  { valor: 'no', titulo: 'No', ayuda: 'No era mi público' },
  { valor: 'nose', titulo: 'No alcancé a saber', ayuda: 'Nadie llegó a hablar con esta persona' },
];

/** La calificación que corresponde a una respuesta, para mandarla al servidor. */
export function calificacionDe(respuesta: ServiaElProspecto): string {
  return CALIFICACION_SEGUN_SERVIA[respuesta];
}

export function PreguntaSiServia({ valor, onCambiar, plural = false, propuesta = false }: {
  valor: ServiaElProspecto;
  onCambiar: (valor: ServiaElProspecto) => void;
  /** En lote la pregunta va en plural: se contesta por toda la tanda. */
  plural?: boolean;
  /** Si el valor actual lo propuso el motivo y nadie lo tocó todavía. Sólo cambia el texto. */
  propuesta?: boolean;
}): JSX.Element {
  return (
    <fieldset className="servia-pregunta">
      <legend>{plural ? '¿Eran el tipo de cliente que buscas?' : '¿Era el tipo de cliente que buscas?'}</legend>
      {/*
        * Se pregunta aunque no hayan comprado, y eso hay que decirlo: sin esta línea la pregunta
        * se lee como «¿compró?», que es otra cosa y ya la responde la etapa.
        */}
      <p className="form-hint">
        Aparte de si {plural ? 'compraron' : 'compró'}. Es lo que decide a quién le mostramos los
        anuncios.
      </p>
      <div className="servia-opciones">
        {OPCIONES.map((opcion) => (
          <label key={opcion.valor} className={valor === opcion.valor ? 'is-elegida' : ''}>
            <input
              type="radio"
              name="servia"
              checked={valor === opcion.valor}
              onChange={() => onCambiar(opcion.valor)}
            />
            <span>
              <strong>{opcion.titulo}</strong>
              <small>{opcion.ayuda}</small>
            </span>
          </label>
        ))}
      </div>
      <p className="form-hint servia-consecuencia">
        {propuesta ? 'Propuesto por el motivo. ' : ''}{CONSECUENCIA[valor]}
      </p>
    </fieldset>
  );
}
