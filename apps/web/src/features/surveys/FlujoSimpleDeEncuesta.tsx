/**
 * @fileoverview El flujo simple de una encuesta: primero las estrellas, después lo demás.
 *
 * Una encuesta larga de entrada se abandona sin dejar nada. Pedir sólo la nota asegura esa
 * respuesta, y lo siguiente depende de cómo le fue:
 *
 * - **Nota baja**: antes que nada, escribirle al equipo en privado. Lo lee el local y puede
 *   responderle; es su única oportunidad de arreglarlo.
 * - **Nota alta**: se pregunta si quiere contestar unas preguntas más. Puede decir que no.
 *
 * **La reseña en Google se ofrece en los dos casos.** La política de Google Maps prohíbe pedirle
 * reseñas sólo a quien quedó contento. A la nota baja se le ofrece primero el canal privado, y la
 * reseña queda disponible, en segundo plano, por si igual quiere dejarla.
 *
 * La nota se guarda apenas se toca: si la persona cierra la pestaña después, esa respuesta ya
 * cuenta en los resultados.
 */

import { useState, type JSX } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Survey, SurveyQuestion } from '@espartanos/shared';
import { ordenarParaMostrar, preguntasVisibles, problemasPorPregunta, traeDatosPersonales } from '@espartanos/shared';
import { AceptacionDeDatos } from './CampoDeEncuesta';
import { api } from '../../core/api';
import { safeUrl } from '../../core/safe-url';

type Answers = Record<string, string | number>;
type Paso = 'nota' | 'mensaje' | 'ofrecer' | 'preguntas' | 'final';

interface Iniciada {
  responseId: string;
  token: string;
  rating: number;
  siguiente: 'mensaje-al-equipo' | 'ofrecer-encuesta';
  reviewUrl: string | null;
  nombre: string | null;
}

export function FlujoSimpleDeEncuesta({
  survey,
  preguntaNota,
  invitacion,
  origen,
  renderPregunta,
}: {
  survey: Survey;
  preguntaNota: SurveyQuestion;
  /** Invitación firmada que trae el correo post-visita. Sin ella la respuesta es anónima. */
  invitacion: string | null;
  origen: string;
  renderPregunta: (pregunta: SurveyQuestion, valor: string | number | undefined, cambiar: (valor: string | number) => void, mostrarError: boolean) => JSX.Element;
}): JSX.Element {
  const [paso, setPaso] = useState<Paso>('nota');
  const [iniciada, setIniciada] = useState<Iniciada | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [respuestas, setRespuestas] = useState<Answers>({});
  const [mensajeEnviado, setMensajeEnviado] = useState(false);
  const [notaElegida, setNotaElegida] = useState<number | null>(null);
  const [aceptada, setAceptada] = useState(false);
  const [intentoEnviar, setIntentoEnviar] = useState(false);

  // Las reglas pueden depender de la nota: se evalúan con ella incluida.
  const conNota = { ...respuestas, ...(notaElegida !== null ? { [preguntaNota.id]: notaElegida } : {}) };
  // La nota va sola primero para no perder esa respuesta; en el paso siguiente, los datos encabezan.
  const restantes = ordenarParaMostrar(preguntasVisibles(survey.questions, conNota).filter((pregunta) => pregunta.id !== preguntaNota.id));
  const porPregunta = problemasPorPregunta(survey.questions, conNota, [preguntaNota.id]);
  const problemas = porPregunta.map((problema) => problema.texto);
  const faltaAceptar = Boolean(survey.consentimiento) && traeDatosPersonales(survey.questions, respuestas) && !aceptada;
  const soloVisibles = () => Object.fromEntries(Object.entries(respuestas).filter(([clave]) => restantes.some((pregunta) => pregunta.id === clave)));

  const iniciar = useMutation({
    mutationFn: (rating: number) => api.post<Iniciada>(`/public/surveys/${encodeURIComponent(survey.id)}/start`, {
      rating,
      ...(invitacion ? { invitacion } : {}),
      origen,
    }),
    onSuccess: (datos) => {
      setIniciada(datos);
      if (datos.siguiente === 'mensaje-al-equipo') setPaso('mensaje');
      // Sin más preguntas no hay nada que ofrecer: se pasa directo al cierre.
      else setPaso(preguntasVisibles(survey.questions, { [preguntaNota.id]: datos.rating }).some((pregunta) => pregunta.id !== preguntaNota.id) ? 'ofrecer' : 'final');
    },
  });

  const completar = useMutation({
    mutationFn: (datos: { answers?: Answers; teamMessage?: string; responder?: boolean; terminar?: boolean; aceptaPrivacidad?: boolean }) => {
      if (!iniciada) throw new Error('La respuesta no se inició');
      return api.post(`/public/surveys/${encodeURIComponent(survey.id)}/responses/${encodeURIComponent(iniciada.responseId)}/complete`, {
        token: iniciada.token,
        ...datos,
      });
    },
  });

  const cerrar = (datos: { answers?: Answers; teamMessage?: string; responder?: boolean; aceptaPrivacidad?: boolean } = {}) => {
    completar.mutate({ ...datos, terminar: true }, {
      onSuccess: () => {
        if (datos.teamMessage) setMensajeEnviado(true);
        setPaso('final');
      },
    });
  };

  /*
   * Con nota baja, después del mensaje se ofrecen las preguntas que la encuesta tenga para ese
   * caso (por ejemplo «¿Qué falló?»). Sin preguntas para mostrar, se cierra como siempre.
   */
  const despuesDelMensaje = (texto?: string) => {
    if (restantes.length === 0) { cerrar(texto ? { teamMessage: texto } : {}); return; }
    if (!texto) { setPaso('ofrecer'); return; }
    completar.mutate({ teamMessage: texto }, { onSuccess: () => { setMensajeEnviado(true); setPaso('ofrecer'); } });
  };

  const resena = iniciada?.reviewUrl ? safeUrl(iniciada.reviewUrl) : '';
  const notaBaja = iniciada?.siguiente === 'mensaje-al-equipo';
  const error = (iniciar.error || completar.error) as Error | null;

  return (
    <div className="flujo-encuesta">
      {paso === 'nota' && <>
        <h2 className="flujo-encuesta-pregunta">{preguntaNota.question}</h2>
        <div className="flujo-estrellas" role="radiogroup" aria-label={preguntaNota.question}>
          {[1, 2, 3, 4, 5].map((valor) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={notaElegida === valor}
              aria-label={`${valor} ${valor === 1 ? 'estrella' : 'estrellas'}`}
              className={notaElegida !== null && valor <= notaElegida ? 'activa' : ''}
              disabled={iniciar.isPending}
              onClick={() => { setNotaElegida(valor); iniciar.mutate(valor); }}
            >
              ★
            </button>
          ))}
        </div>
        <small className="flujo-encuesta-ayuda">{iniciar.isPending ? 'Guardando…' : 'Toca una estrella'}</small>
      </>}

      {paso === 'mensaje' && <>
        <h2 className="flujo-encuesta-pregunta">{iniciada?.nombre ? `${iniciada.nombre}, lamentamos` : 'Lamentamos'} que no haya sido lo que esperabas</h2>
        <p>¿Nos cuentas qué pasó? Lo lee el equipo del local y no se publica en ninguna parte.</p>
        <label className="public-survey-field">
          <span className="sr-only">Mensaje para el equipo</span>
          <textarea rows={5} maxLength={2000} value={mensaje} onChange={(evento) => setMensaje(evento.target.value)} placeholder="Qué pasó, y qué habría hecho la diferencia" />
        </label>
        <div className="flujo-encuesta-acciones">
          <button type="button" className="btn btn-primary btn-block" disabled={!mensaje.trim() || completar.isPending} onClick={() => despuesDelMensaje(mensaje)}>
            {completar.isPending ? 'Enviando…' : 'Enviar al equipo'}
          </button>
          <button type="button" className="btn btn-outline btn-block" disabled={completar.isPending} onClick={() => despuesDelMensaje()}>Prefiero no escribir</button>
        </div>
      </>}

      {paso === 'ofrecer' && <>
        <h2 className="flujo-encuesta-pregunta">¡Gracias{iniciada?.nombre ? `, ${iniciada.nombre}` : ''}!</h2>
        <p>¿Nos respondes {restantes.length === 1 ? 'una pregunta más' : `${restantes.length} preguntas más`}? Toma menos de un minuto.</p>
        <div className="flujo-encuesta-acciones">
          <button type="button" className="btn btn-primary btn-block" onClick={() => setPaso('preguntas')}>Sí, contesto</button>
          <button type="button" className="btn btn-outline btn-block" disabled={completar.isPending} onClick={() => cerrar()}>No, gracias</button>
        </div>
      </>}

      {paso === 'preguntas' && <>
        <div className="public-survey-questions">
          {restantes.map((pregunta) => (
            <div key={pregunta.id} id={`pregunta-${pregunta.id}`}>
              {renderPregunta(pregunta, respuestas[pregunta.id], (valor) => setRespuestas((actuales) => ({ ...actuales, [pregunta.id]: valor })), intentoEnviar)}
              {intentoEnviar && porPregunta.find((problema) => problema.id === pregunta.id)
                ? <p className="public-survey-problema" role="alert">{porPregunta.find((problema) => problema.id === pregunta.id)!.texto}</p>
                : null}
            </div>
          ))}
        </div>
        {survey.consentimiento && traeDatosPersonales(survey.questions, respuestas) ? <AceptacionDeDatos consentimiento={survey.consentimiento} aceptada={aceptada} onChange={setAceptada} /> : null}
        {intentoEnviar && (problemas.length > 0 || faltaAceptar) ? <div className="alert alert-error" role="alert">{[...problemas, ...(faltaAceptar ? ['Acepta el uso de tus datos para enviar'] : [])].join(' · ')}</div> : null}
        <button type="button" className="btn btn-primary btn-block public-survey-submit" disabled={completar.isPending} onClick={() => {
          setIntentoEnviar(true);
          /*
           * Llevar hasta lo que falta, no sólo decir que falta.
           *
           * En una encuesta larga, una lista de textos al pie obliga a recorrerla entera
           * comparando pregunta por pregunta, y el botón queda al final: quien responde no ve lo
           * que tiene que corregir.
           */
          if (problemas.length > 0 || faltaAceptar) {
            const primera = porPregunta[0];
            const destino = primera ? document.getElementById(`pregunta-${primera.id}`) : null;
            destino?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
          cerrar({ answers: soloVisibles(), responder: true, ...(aceptada ? { aceptaPrivacidad: true } : {}) });
        }}>
          {completar.isPending ? 'Enviando…' : 'Enviar respuestas'}
        </button>
      </>}

      {paso === 'final' && <div className="public-survey-success">
        <span aria-hidden="true">✓</span>
        <h2 className="flujo-encuesta-pregunta">{mensajeEnviado ? 'Tu mensaje ya le llegó al equipo' : 'Gracias por contarnos'}</h2>
        {notaBaja
          ? <>
            <p>{mensajeEnviado ? 'Lo van a leer con atención.' : 'Tu nota quedó registrada.'}</p>
            {/* Disponible también con nota baja, pero en segundo plano: se ofreció primero el canal privado. */}
            {resena ? <a className="flujo-encuesta-resena-discreta" href={resena} target="_blank" rel="noopener noreferrer">Si igual quieres, también puedes opinar en Google</a> : null}
          </>
          : <>
            <p>Tu opinión ayuda a que más gente nos encuentre.</p>
            {resena ? <a className="btn btn-primary btn-block" href={resena} target="_blank" rel="noopener noreferrer">Dejar una reseña en Google</a> : null}
          </>}
      </div>}

      {error ? <div className="alert alert-error" role="alert">{error.message}</div> : null}
    </div>
  );
}
