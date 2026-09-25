/**
 * @fileoverview El editor de una regla, escrito para quien vende y no para quien programa.
 *
 * La versión anterior era un formulario: «Nombre», «unir», «Condiciones», «contiene». Todas
 * esas son palabras del sistema, no de la persona que mira leads todo el día, y obligaban a
 * traducir mentalmente antes de poder decidir. Aquí se pregunta lo que de verdad se quiere
 * saber —a cuáles leads, qué hago con ellos— en tres pasos numerados, y el nombre se pide al
 * final porque nadie sabe cómo llamar a una regla antes de haberla escrito.
 *
 * La frase de resumen no es decoración: es la única forma de comprobar lo que se va a guardar
 * sin leer los desplegables uno por uno.
 */

import { Modal } from '../../shared/Modal';
import { CALIFICACIONES, CALIFICACION_ROTULOS } from './calificacion';

export interface Condicion { donde: string; clave?: string; comparador: string; valor?: string }
export interface Acciones {
  semaforo?: 'green' | 'yellow' | 'red';
  calificacion?: string;
  /** La columna del tablero a la que se mueve el lead. */
  etapa?: string;
  descartarMotivo?: string;
  nota?: string;
}
export interface Borrador {
  nombre: string;
  unir: 'todas' | 'alguna';
  condiciones: Condicion[];
  acciones: Acciones;
}
export interface Pregunta {
  pregunta: string;
  total: number;
  respuestas: Array<{ respuesta: string; total: number; tieneRegla: boolean }>;
}

/**
 * Dónde mira cada condición, dicho como lo diría una persona.
 *
 * `enFrase` es lo que se lee en el resumen y `label` lo que se elige en la lista: no siempre
 * coinciden, porque una lista se lee suelta y una frase tiene que encajar con lo de al lado.
 */
export const DONDE = [
  { value: 'respuestas', label: 'Lo que contestó en el formulario', enFrase: 'lo que contestó' },
  { value: 'pregunta', label: 'Su respuesta a una pregunta en particular', enFrase: 'su respuesta a esa pregunta' },
  { value: 'campo', label: 'Un dato tuyo del lead (campo propio)', enFrase: 'ese dato del lead' },
  { value: 'fuente', label: 'De dónde llegó el lead', enFrase: 'de dónde llegó' },
  { value: 'responsable', label: 'Quién lo está atendiendo', enFrase: 'quién lo atiende' },
  { value: 'monto', label: 'El monto de la venta', enFrase: 'el monto' },
  { value: 'campana', label: 'La campaña que lo trajo', enFrase: 'la campaña' },
];

export const COMPARADORES = [
  { value: 'contiene', label: 'incluye estas palabras', enFrase: 'incluye' },
  { value: 'no_contiene', label: 'NO incluye estas palabras', enFrase: 'no incluye' },
  { value: 'es', label: 'dice exactamente esto', enFrase: 'dice exactamente' },
  { value: 'no_es', label: 'dice cualquier cosa menos esto', enFrase: 'no dice' },
  { value: 'mayor_que', label: 'es un número mayor que', enFrase: 'es mayor que' },
  { value: 'menor_que', label: 'es un número menor que', enFrase: 'es menor que' },
  { value: 'vacio', label: 'viene en blanco (no contestó)', enFrase: 'viene en blanco' },
  { value: 'no_vacio', label: 'trae algo escrito, sea lo que sea', enFrase: 'trae algo escrito' },
];

/** Los comparadores que no necesitan un valor escrito. */
export const SIN_VALOR = ['vacio', 'no_vacio'];

/**
 * Qué hace la regla, con la consecuencia dicha en voz alta.
 *
 * «Verde» no significa nada por sí solo: lo que hay que entender antes de elegir es que a ese
 * lead hay que llamarlo. Por eso cada opción trae la frase que la explica, y no una etiqueta.
 */
export const SEMAFOROS = [
  { value: 'green', titulo: 'Marcarlo VERDE', ayuda: 'Es un buen lead: hay que contactarlo.', enFrase: 'lo marco verde' },
  { value: 'yellow', titulo: 'Marcarlo AMARILLO', ayuda: 'Dudoso: alguien tiene que mirarlo antes.', enFrase: 'lo marco amarillo' },
  { value: 'red', titulo: 'Marcarlo ROJO', ayuda: 'No sirve: no vale la pena llamarlo.', enFrase: 'lo marco rojo' },
  { value: '', titulo: 'No tocar el color', ayuda: 'Sólo anotar el motivo o descartarlo, sin calificar.', enFrase: 'no le cambio el color' },
];

/** Los comparadores que piden un número y no un texto. */
const NUMERICOS = ['mayor_que', 'menor_que'];

export const CONDICION_NUEVA: Condicion = { donde: 'respuestas', comparador: 'contiene', valor: '' };

/** Una columna del tablero, con el nombre que le puso esa empresa. */
export interface EtapaDisponible { value: string; titulo: string }

/** Algo que falta, y dónde está el campo que lo resuelve. */
export interface Falta { texto: string; ancla: string }

/**
 * Lo que falta para que la regla se pueda guardar, y dónde arreglarlo.
 *
 * Un botón apagado sin explicación es lo que hace que alguien abandone la pantalla: se ve que
 * no se puede guardar y no se ve por qué. Cada falta viaja con el `id` del campo que la
 * resuelve, para poder llevar hasta él en vez de describirlo.
 */
export function loQueFalta(borrador: Borrador): Falta[] {
  const faltas: Falta[] = [];
  borrador.condiciones.forEach((condicion, indice) => {
    const cual = borrador.condiciones.length > 1 ? ` de la comprobación ${indice + 1}` : '';
    if (['pregunta', 'campo'].includes(condicion.donde) && !String(condicion.clave ?? '').trim()) {
      faltas.push({
        texto: condicion.donde === 'pregunta' ? `Elige cuál pregunta mirar${cual}.` : `Escribe cuál de tus campos mirar${cual}.`,
        ancla: `regla-cual-${indice}`,
      });
    }
    if (!SIN_VALOR.includes(condicion.comparador) && !String(condicion.valor ?? '').trim()) {
      faltas.push({
        texto: NUMERICOS.includes(condicion.comparador)
          ? `Escribe el número con el que comparar${cual}.`
          : `Escribe el texto que hay que buscar${cual}.`,
        ancla: `regla-valor-${indice}`,
      });
    }
  });
  if (!borrador.acciones.semaforo && !borrador.acciones.etapa && !borrador.acciones.calificacion && !borrador.acciones.descartarMotivo) {
    faltas.push({
      texto: 'Elige qué hacer con esos leads: un color, una columna, una calificación, o varias de ellas.',
      ancla: 'regla-acciones',
    });
  }
  if (!borrador.nombre.trim()) faltas.push({ texto: 'Ponle un nombre a la regla.', ancla: 'regla-nombre' });
  return faltas;
}

/**
 * Lleva hasta el campo que falta y lo deja listo para escribir.
 *
 * Decir «falta el texto de la comprobación 2» en un formulario que no cabe en la pantalla
 * obliga a buscarlo; esto lo trae. El foco va después del desplazamiento porque enfocar ya
 * mueve la pantalla, y hacerlo dos veces la deja a medio camino.
 */
function irAlCampo(id: string): void {
  const elemento = document.getElementById(id);
  if (!elemento) return;
  elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => (elemento as HTMLElement).focus({ preventScroll: true }), 250);
}

/** La regla dicha en una sola frase, tal como quedará guardada. */
export function comoSeLee(borrador: Borrador, etapas: EtapaDisponible[] = []): string {
  const partes = borrador.condiciones.map((condicion) => {
    const donde = DONDE.find((opcion) => opcion.value === condicion.donde)?.enFrase ?? condicion.donde;
    const compara = COMPARADORES.find((opcion) => opcion.value === condicion.comparador)?.enFrase ?? condicion.comparador;
    const valor = SIN_VALOR.includes(condicion.comparador) ? '' : ` «${String(condicion.valor ?? '').trim() || '…'}»`;
    const cual = condicion.clave ? ` (${condicion.clave})` : '';
    return `${donde}${cual} ${compara}${valor}`;
  });
  const unidas = partes.join(borrador.unir === 'alguna' ? ', o bien ' : ', y además ');
  const etapa = etapas.find((opcion) => opcion.value === (borrador.acciones.etapa ?? ''));
  const hechos = [
    borrador.acciones.semaforo
      ? SEMAFOROS.find((opcion) => opcion.value === borrador.acciones.semaforo)?.enFrase
      : '',
    etapa ? `lo muevo a «${etapa.titulo}»` : '',
    borrador.acciones.calificacion ? `lo dejo como «${CALIFICACION_ROTULOS[borrador.acciones.calificacion] ?? borrador.acciones.calificacion}»` : '',
    borrador.acciones.descartarMotivo ? `lo descarto («${borrador.acciones.descartarMotivo}»)` : '',
  ].filter(Boolean);
  return `Si ${unidas || '…'}, entonces ${hechos.join(' y ') || 'no hago nada todavía'}.`;
}

/**
 * @param borrador - La regla que se está escribiendo.
 * @param preguntas - Lo que están contestando los leads, para sugerir el texto exacto en vez
 *   de que se escriba de memoria: un acento de más deja la regla sin calzar con nadie.
 */
export function EditorDeRegla({
  borrador, setBorrador, editando, preguntas, etapas, prueba, probando, onProbar, guardando, onGuardar, onCerrar,
}: {
  borrador: Borrador;
  setBorrador: (siguiente: Borrador) => void;
  editando: { nombre: string } | null;
  preguntas: Pregunta[];
  etapas: EtapaDisponible[];
  prueba: { total: number; revisados: number; ejemplos: Array<{ nombre: string; porque: string }> } | null;
  probando: boolean;
  onProbar: () => void;
  guardando: boolean;
  onGuardar: () => void;
  onCerrar: () => void;
}) {
  const cambiarCondicion = (indice: number, cambios: Partial<Condicion>) => {
    const condiciones = borrador.condiciones.map((condicion, i) => (i === indice ? { ...condicion, ...cambios } : condicion));
    setBorrador({ ...borrador, condiciones });
  };

  const respuestasSugeridas = preguntas.flatMap((fila) => fila.respuestas.map((respuesta) => respuesta.respuesta));
  const faltas = loQueFalta(borrador);
  /* Probar sólo necesita las condiciones: el nombre y el color no cambian a quién alcanza. */
  const puedeProbar = !faltas.some((falta) => !falta.texto.startsWith('Ponle un nombre') && !falta.texto.startsWith('Elige qué hacer'));
  const listo = faltas.length === 0;

  return (
    <Modal open onClose={onCerrar} title={editando ? `Editar «${editando.nombre}»` : 'Crear una regla'}>
      <div className="modal-form regla-guiada">
        <p className="regla-guiada-entrada">
          Una regla mira cada lead que entra y, si cumple lo que tú digas, lo marca sola. Son
          tres preguntas.
        </p>

        {/* ---------------------------------------------------------------- PASO 1 */}
        <section className="regla-paso">
          <h4><span className="regla-paso-numero">1</span> ¿A qué leads quieres que se aplique?</h4>
          <p className="regla-paso-ayuda">
            Describe cómo reconoces a esos leads. Si no sabes qué escribir, mira en la pantalla
            de atrás lo que están contestando de verdad: el texto tiene que coincidir con el suyo.
          </p>

          <datalist id="respuestas-reales">
            {[...new Set(respuestasSugeridas)].map((respuesta) => <option key={respuesta} value={respuesta} />)}
          </datalist>

          {borrador.condiciones.map((condicion, indice) => (
            <div key={indice} className="regla-condicion">
              <div className="regla-condicion-encabezado">
                <span>{indice === 0 ? 'Si…' : borrador.unir === 'alguna' ? 'O si…' : 'Y si…'}</span>
                {borrador.condiciones.length > 1 ? (
                  <button type="button" className="btn btn-outline btn-xs"
                    aria-label={`Quitar la comprobación ${indice + 1}`}
                    onClick={() => setBorrador({ ...borrador, condiciones: borrador.condiciones.filter((_, i) => i !== indice) })}>
                    Quitar
                  </button>
                ) : null}
              </div>

              <label>Qué miro del lead
                <select className="input" value={condicion.donde}
                  onChange={(evento) => cambiarCondicion(indice, { donde: evento.target.value })}>
                  {DONDE.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}
                </select>
              </label>

              {condicion.donde === 'pregunta' ? (
                <label htmlFor={`regla-cual-${indice}`}>¿Cuál pregunta?
                  <select id={`regla-cual-${indice}`} className="input" value={condicion.clave ?? ''}
                    onChange={(evento) => cambiarCondicion(indice, { clave: evento.target.value })}>
                    <option value="">Elige una de las que están llegando…</option>
                    {preguntas.map((fila) => <option key={fila.pregunta} value={fila.pregunta}>{fila.pregunta}</option>)}
                  </select>
                </label>
              ) : null}

              {condicion.donde === 'campo' ? (
                <label htmlFor={`regla-cual-${indice}`}>¿Cuál dato?
                  <input id={`regla-cual-${indice}`} className="input" placeholder="La clave del campo propio, por ejemplo: comuna"
                    value={condicion.clave ?? ''}
                    onChange={(evento) => cambiarCondicion(indice, { clave: evento.target.value })} />
                </label>
              ) : null}

              <label>Y esa respuesta…
                <select className="input" value={condicion.comparador}
                  onChange={(evento) => cambiarCondicion(indice, { comparador: evento.target.value })}>
                  {COMPARADORES.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}
                </select>
              </label>

              {/*
                Un número se pide como número.

                Con «es mayor que» el campo seguía diciendo «¿Qué texto?» y ofreciendo las
                respuestas del formulario: se elegía «Crédito Banco» como si fuera una
                cantidad, y la regla no calzaba nunca sin decir por qué.
              */}
              {SIN_VALOR.includes(condicion.comparador) ? (
                <p className="regla-sin-valor">Esta comprobación no necesita que escribas nada más.</p>
              ) : NUMERICOS.includes(condicion.comparador) ? (
                <label htmlFor={`regla-valor-${indice}`}>¿Qué número?
                  <input id={`regla-valor-${indice}`} className="input" type="number" value={condicion.valor ?? ''}
                    placeholder="Ej: 50000000"
                    onChange={(evento) => cambiarCondicion(indice, { valor: evento.target.value })} />
                  <small>Escríbelo sin puntos ni signo peso. Cincuenta millones es 50000000.</small>
                </label>
              ) : (
                <label htmlFor={`regla-valor-${indice}`}>¿Qué texto?
                  <input id={`regla-valor-${indice}`} className="input" list="respuestas-reales" value={condicion.valor ?? ''}
                    placeholder="Escribe o elige una respuesta real. Ej: contado"
                    onChange={(evento) => cambiarCondicion(indice, { valor: evento.target.value })} />
                  <small>
                    No importan las mayúsculas ni los acentos: «Contado», «contado» y «CONTADO»
                    valen lo mismo.
                  </small>
                </label>
              )}
            </div>
          ))}

          <button type="button" className="btn btn-outline btn-sm" disabled={borrador.condiciones.length >= 10}
            onClick={() => setBorrador({ ...borrador, condiciones: [...borrador.condiciones, { ...CONDICION_NUEVA }] })}>
            + Pedir otra cosa más
          </button>

          {/*
            La pregunta de «todas o una» sólo existe cuando hay más de una comprobación.
            Mostrarla antes obliga a responder algo que todavía no significa nada.
          */}
          {borrador.condiciones.length > 1 ? (
            <fieldset className="regla-unir">
              <legend>Con varias comprobaciones, ¿cómo las junto?</legend>
              <label className="toggle-row">
                <input type="radio" name="regla-unir" checked={borrador.unir === 'todas'}
                  onChange={() => setBorrador({ ...borrador, unir: 'todas' })} />
                {' '}Tienen que cumplirse <strong>todas</strong>
                <small>Más estricto: entran menos leads, pero más seguros.</small>
              </label>
              <label className="toggle-row">
                <input type="radio" name="regla-unir" checked={borrador.unir === 'alguna'}
                  onChange={() => setBorrador({ ...borrador, unir: 'alguna' })} />
                {' '}Basta con que se cumpla <strong>una</strong>
                <small>Más amplio: entran más leads.</small>
              </label>
            </fieldset>
          ) : null}
        </section>

        {/* ---------------------------------------------------------------- PASO 2 */}
        <section className="regla-paso" id="regla-acciones" tabIndex={-1}>
          <h4><span className="regla-paso-numero">2</span> ¿Qué hago con esos leads?</h4>
          <p className="regla-paso-ayuda">
            Son tres cosas distintas y se eligen por separado: el <strong>color</strong> que ve
            tu equipo, la <strong>columna</strong> donde va a buscarlo, y la
            <strong> calificación</strong> que se informa a Meta. Puedes usar una sola, dos, o las tres.
          </p>

          <fieldset className="regla-eleccion">
            <legend>a. ¿De qué color lo marco?</legend>
            <p className="regla-paso-ayuda">Es el color de la tarjeta: lo que tu equipo ve de un vistazo en el tablero.</p>
            <div className="regla-opciones">
              {SEMAFOROS.map((opcion) => {
                const elegida = (borrador.acciones.semaforo ?? '') === opcion.value;
                return (
                  <label key={opcion.value || 'sin-color'} className={`regla-opcion ${elegida ? 'elegida' : ''} sem-${opcion.value || 'ninguno'}`}>
                    <input type="radio" name="regla-semaforo" checked={elegida}
                      onChange={() => setBorrador({ ...borrador, acciones: { ...borrador.acciones, semaforo: (opcion.value || undefined) as Acciones['semaforo'] } })} />
                    <span>
                      <strong>{opcion.titulo}</strong>
                      <small>{opcion.ayuda}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/*
            La columna, con el mismo aspecto que el color y no como un desplegable suelto.

            Son la misma clase de decisión —elegir una de unas pocas opciones nombradas— y
            escondida dentro del color parecía un detalle del color, cuando es lo que decide si
            alguien va a trabajar ese lead o se queda donde nadie lo mira.
          */}
          <fieldset className="regla-eleccion">
            <legend>b. ¿A qué columna del tablero lo muevo?</legend>
            <p className="regla-paso-ayuda">Son las columnas de tu tablero, con los nombres que tú les pusiste.</p>
            <div className="regla-opciones regla-opciones-columnas">
              {[{ value: '', titulo: 'Dejarlo donde está', ayuda: 'No se mueve de columna.' }, ...etapas.map((etapa) => ({ ...etapa, ayuda: '' }))].map((etapa) => {
                const elegida = (borrador.acciones.etapa ?? '') === etapa.value;
                return (
                  <label key={etapa.value || 'quieto'} className={`regla-opcion ${elegida ? 'elegida' : ''}`}>
                    <input type="radio" name="regla-etapa" checked={elegida}
                      onChange={() => setBorrador({ ...borrador, acciones: { ...borrador.acciones, etapa: etapa.value || undefined } })} />
                    <span>
                      <strong>{etapa.titulo}</strong>
                      {etapa.ayuda ? <small>{etapa.ayuda}</small> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/*
            La calificación, que no es el color ni la columna.

            El color es la opinión de un vistazo, la columna es dónde va a buscarlo el equipo y
            la calificación es el estado comercial que se informa hacia afuera —es lo que se le
            manda a Meta—. Estaban colapsadas en el color, así que una regla no podía decir
            «marcarlo verde pero dejarlo pendiente hasta que alguien lo llame».
          */}
          <fieldset className="regla-eleccion">
            <legend>c. ¿En qué calificación lo dejo?</legend>
            <p className="regla-paso-ayuda">
              Es el estado comercial del lead, aparte del color. Es lo que se informa a Meta
              para que aprenda a quién traerte.
            </p>
            <div className="regla-opciones regla-opciones-columnas">
              {[{ value: '', label: 'No tocar la calificación' }, ...CALIFICACIONES].map((opcion) => {
                const elegida = (borrador.acciones.calificacion ?? '') === opcion.value;
                return (
                  <label key={opcion.value || 'sin-calificacion'} className={`regla-opcion ${elegida ? 'elegida' : ''}`}>
                    <input type="radio" name="regla-calificacion" checked={elegida}
                      onChange={() => setBorrador({ ...borrador, acciones: { ...borrador.acciones, calificacion: opcion.value || undefined } })} />
                    <span>
                      <strong>{opcion.label}</strong>
                      {opcion.value ? null : <small>Se queda como esté.</small>}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="regla-descartar">
            ¿Además quieres sacarlo de la lista de pendientes? Escribe por qué
            <input className="input" value={borrador.acciones.descartarMotivo ?? ''} maxLength={200}
              placeholder="Déjalo vacío para no sacarlo. Ej: sólo estaba cotizando"
              onChange={(evento) => setBorrador({ ...borrador, acciones: { ...borrador.acciones, descartarMotivo: evento.target.value || undefined } })} />
            <small>Si lo dejas vacío, el lead sigue en la lista y sólo cambia de color.</small>
          </label>
        </section>

        {/* ---------------------------------------------------------------- PASO 3 */}
        <section className="regla-paso">
          <h4><span className="regla-paso-numero">3</span> Revisa que diga lo que quieres</h4>

          <p className="regla-resumen">{comoSeLee(borrador, etapas)}</p>

          {/*
            Probar antes de guardar.

            El número es lo que caza el error tonto: si sale 0 la regla no sirve, y si salen
            todos está mal escrita. Verlo ahora evita descubrirlo con cien leads calificados.
          */}
          <button type="button" className="btn btn-outline btn-sm" disabled={!puedeProbar || probando} onClick={onProbar}>
            {probando ? 'Probando…' : 'Probar con mis leads de verdad'}
          </button>

          {prueba ? (
            <div className={prueba.total === 0 ? 'alert alert-warning' : 'alert alert-info'}>
              <strong>{prueba.total} de {prueba.revisados}</strong> leads de los que ya tienes
              quedarían así.
              {prueba.total === 0 ? ' Ninguno calza: revisa el texto, porque así no marcaría a nadie.' : null}
              {prueba.total === prueba.revisados && prueba.revisados > 0 ? ' Calzan todos: probablemente la regla es demasiado amplia.' : null}
              {prueba.ejemplos.length > 0 ? (
                <ul>{prueba.ejemplos.map((ejemplo, i) => <li key={i}>{ejemplo.nombre} — porque decía «{ejemplo.porque}»</li>)}</ul>
              ) : null}
            </div>
          ) : null}

          <label htmlFor="regla-nombre">Ponle un nombre para reconocerla en la lista
            <input id="regla-nombre" className="input" value={borrador.nombre} maxLength={120}
              onChange={(evento) => setBorrador({ ...borrador, nombre: evento.target.value })}
              placeholder="Ej. Paga al contado" />
          </label>
        </section>

        <p className="field-hint">
          Al guardarla queda en <strong>«solo a mano»</strong>: no toca nada hasta que tú la
          apliques. Cuando confíes en ella, la sueltas desde la lista con
          «Aplicarla sola».
        </p>

        {/*
          Por qué todavía no se puede guardar, escrito.

          Un botón apagado y nada más es lo que hace abandonar la pantalla: se ve que no se
          puede y no se ve qué falta.
        */}
        {faltas.length > 0 ? (
          <div className="alert alert-warning" role="status">
            <strong>Falta esto para poder guardarla:</strong>
            <ul>{faltas.map((falta) => (
              <li key={falta.ancla + falta.texto}>
                <button type="button" className="regla-falta" onClick={() => irAlCampo(falta.ancla)}>
                  {falta.texto} <span>Ir ahí</span>
                </button>
              </li>
            ))}</ul>
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!listo || guardando} onClick={onGuardar}>
            {guardando ? 'Guardando…' : 'Guardar la regla'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
