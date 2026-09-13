/**
 * @fileoverview Qué contestó cada persona, empezando por los mensajes al equipo.
 *
 * Los promedios dicen cuánto; lo que se lee para actuar es qué dijo cada uno. Y los mensajes
 * privados —lo que alguien con nota baja quiso contarle al local antes de publicar nada— no
 * aparecen en ningún gráfico: por eso van primero y resaltados.
 *
 * Nombre y correo sólo existen si la respuesta llegó por el correo posterior a una reserva. Las
 * de enlace o QR siguen anónimas, y así se muestran.
 */

import { Fragment, useMemo, useState, type JSX } from 'react';
import type { SurveyIndividualResponse, SurveyQuestion } from '@espartanos/shared';

export type RespuestaIndividual = SurveyIndividualResponse;

type Filtro = 'todas' | 'mensajes' | 'bajas';

export function RespuestasPorPersona({ respuestas, preguntas }: { respuestas: RespuestaIndividual[]; preguntas: SurveyQuestion[] }): JSX.Element {
  const [filtro, setFiltro] = useState<Filtro>(() => (respuestas.some((respuesta) => respuesta.teamMessage) ? 'mensajes' : 'todas'));
  const [abierta, setAbierta] = useState<string | null>(null);
  const porId = useMemo(() => new Map(preguntas.map((pregunta) => [pregunta.id, pregunta])), [preguntas]);

  const conMensaje = respuestas.filter((respuesta) => respuesta.teamMessage).length;
  const bajas = respuestas.filter((respuesta) => respuesta.rating !== null && respuesta.rating <= 3).length;
  const visibles = respuestas
    .filter((respuesta) => filtro === 'todas' || (filtro === 'mensajes' ? Boolean(respuesta.teamMessage) : respuesta.rating !== null && respuesta.rating <= 3))
    // Los mensajes primero dentro de cualquier filtro: son lo que alguien tiene que contestar.
    .sort((a, b) => Number(Boolean(b.teamMessage)) - Number(Boolean(a.teamMessage)));

  return (
    <section className="respuestas-persona">
      <header>
        <h2>Qué contestó cada persona</h2>
        <div className="respuestas-persona-filtros" role="group" aria-label="Filtrar respuestas">
          {([['todas', `Todas (${respuestas.length})`], ['mensajes', `Con mensaje al equipo (${conMensaje})`], ['bajas', `3 estrellas o menos (${bajas})`]] as Array<[Filtro, string]>).map(([valor, etiqueta]) => (
            <button key={valor} type="button" aria-pressed={filtro === valor} className={filtro === valor ? 'active' : ''} onClick={() => setFiltro(valor)}>{etiqueta}</button>
          ))}
        </div>
      </header>

      {visibles.length === 0 ? <p className="page-subtitle">No hay respuestas con este filtro.</p> : (
        <ul>
          {visibles.map((respuesta) => {
            const detalle = Object.entries(respuesta.answers)
              .filter(([clave]) => porId.get(clave)?.type !== 'rating')
              .map(([clave, valor]) => ({ pregunta: porId.get(clave)?.question ?? clave, valor }));
            const estaAbierta = abierta === respuesta.id;
            return (
              <li key={respuesta.id} className={respuesta.teamMessage ? 'con-mensaje' : ''}>
                <button type="button" className="respuestas-persona-fila" aria-expanded={estaAbierta} onClick={() => setAbierta(estaAbierta ? null : respuesta.id)}>
                  <span className="respuestas-persona-nota" aria-label={respuesta.rating ? `${respuesta.rating} de 5` : 'Sin nota'}>
                    {respuesta.rating ? '★'.repeat(respuesta.rating) + '☆'.repeat(5 - respuesta.rating) : '—'}
                  </span>
                  <strong>{respuesta.respondentName || 'Anónimo'}</strong>
                  <small>
                    {new Date(respuesta.submittedAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}
                    {respuesta.completedAt ? '' : ' · dejó sólo la nota'}
                  </small>
                </button>
                {respuesta.teamMessage && <blockquote>«{respuesta.teamMessage}»</blockquote>}
                {estaAbierta && <dl>
                  {respuesta.respondentEmail && <><dt>Correo</dt><dd><a href={`mailto:${respuesta.respondentEmail}`}>{respuesta.respondentEmail}</a></dd></>}
                  {detalle.length === 0 ? <><dt>Respuestas</dt><dd>No contestó más preguntas.</dd></> : detalle.map((item) => <Fragment key={item.pregunta}><dt>{item.pregunta}</dt><dd>{String(item.valor)}</dd></Fragment>)}
                </dl>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
