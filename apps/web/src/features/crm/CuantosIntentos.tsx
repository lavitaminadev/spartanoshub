/**
 * @fileoverview Cuántas veces se intentó contactar antes de cerrar la ficha.
 *
 * Es el dato que decide si «nunca respondió» significa que la persona no contesta o que nadie la
 * llamó. Sin él las dos cosas se escriben igual, y son problemas distintos: una es el origen del
 * tráfico, la otra es el seguimiento.
 *
 * **Se pregunta en todo descarte, no sólo en los motivos dudosos.** Exigirlo en uno encarece ese
 * camino frente a los demás, y quien tiene veinte fichas que cerrar elige el motivo que no le
 * pregunta nada: la estadística mejora de aspecto y empeora de contenido.
 *
 * **Botones y no un campo libre.** Un número exacto no aporta nada sobre «cuatro o más», y
 * escribirlo cuesta más que elegirlo. Lo que se mide es el orden de magnitud del esfuerzo.
 *
 * **«Ninguno» es una respuesta legítima**, no un castigo: descartar sin intentar es correcto
 * cuando los datos vienen errados o el perfil está claramente fuera. Lo que no puede es quedar
 * oculto, porque es justamente la cifra que no existía en ninguna pantalla.
 */

import type { JSX } from 'react';

/** Valor que viaja a la API. `null` es «todavía no eligió». */
export type IntentosDeContacto = 0 | 1 | 2 | 3 | 4 | null;

const OPCIONES: ReadonlyArray<{ valor: Exclude<IntentosDeContacto, null>; rotulo: string }> = [
  { valor: 0, rotulo: 'Ninguno' },
  { valor: 1, rotulo: '1' },
  { valor: 2, rotulo: '2' },
  { valor: 3, rotulo: '3' },
  { valor: 4, rotulo: '4 o más' },
];

export function CuantosIntentos({ valor, onCambiar, avisoDeContradiccion }: {
  valor: IntentosDeContacto;
  onCambiar: (valor: Exclude<IntentosDeContacto, null>) => void;
  /** Texto que se muestra cuando lo elegido no concuerda con el motivo. */
  avisoDeContradiccion?: string | null;
}): JSX.Element {
  return (
    <fieldset className="pregunta-intentos">
      <legend>¿Cuántas veces intentaste contactarlo?</legend>
      <div className="pregunta-intentos-opciones">
        {OPCIONES.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            className={`btn btn-outline btn-sm ${valor === opcion.valor ? 'is-elegida' : ''}`}
            aria-pressed={valor === opcion.valor}
            onClick={() => onCambiar(opcion.valor)}
          >
            {opcion.rotulo}
          </button>
        ))}
      </div>
      {/*
        * La contradicción se nombra, no se bloquea.
        *
        * Impedir el descarte sólo lograría que se eligiera otro motivo con tal de cerrar la
        * ficha, y entonces el dato se pierde además de quedar mal atribuido. Dicho en voz alta,
        * quien tenga que corregirlo lo corrige y quien no, deja constancia de lo que hizo.
        */}
      {avisoDeContradiccion ? <p className="form-hint form-hint-aviso">{avisoDeContradiccion}</p> : null}
    </fieldset>
  );
}
