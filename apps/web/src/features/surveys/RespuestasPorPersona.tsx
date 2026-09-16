/**
 * @fileoverview Qué contestó cada persona, empezando por los mensajes al equipo.
 *
 * Los promedios dicen cuánto; lo que se lee para actuar es qué dijo cada uno. Los mensajes
 * privados —lo que alguien con nota baja quiso contarle al local— no aparecen en ningún gráfico:
 * por eso van primero y resaltados, con la forma de contactar a la persona si dejó cómo.
 *
 * Nombre y correo existen si la respuesta llegó por el correo de una reserva o si la encuesta los
 * pidió. Las demás siguen anónimas, y así se muestran.
 */

import { Fragment, useMemo, useState, type JSX } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { triggerToast } from '../../shared/toast-events';
import type { SurveyIndividualResponse, SurveyQuestion } from '@espartanos/shared';
import { DATOS_DE_CONTACTO } from '@espartanos/shared';

export type RespuestaIndividual = SurveyIndividualResponse;

type Filtro = 'pendientes' | 'todas' | 'mensajes' | 'bajas' | 'con-contacto';

/** Lo que alguien debería contestar: un mensaje al equipo o una nota de 3 estrellas o menos. */
function requiereAtencion(respuesta: RespuestaIndividual): boolean {
  return Boolean(respuesta.teamMessage) || (respuesta.rating !== null && respuesta.rating <= 3);
}

/** Enlace de WhatsApp para un teléfono chileno escrito de cualquier forma. */
/**
 * Enlace de WhatsApp con el mensaje ya escrito.
 *
 * Quien atiende una nota baja tiene que escribir el saludo, explicar quién es y recordar qué pasó,
 * y eso se hace entre mesas: sin el mensaje listo, la respuesta se posterga y se pierde. El texto
 * queda editable en WhatsApp antes de enviarlo, que es lo que hay que poder hacer.
 */
function enlaceWhatsapp(telefono: string, nombre?: string | null): string | null {
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.length < 8) return null;
  const completo = digitos.length === 9 ? `56${digitos}` : digitos.length === 8 ? `569${digitos}` : digitos;
  const saludo = nombre?.trim() ? `Hola ${nombre.trim().split(/\s+/)[0]}` : 'Hola';
  const mensaje = `${saludo}, gracias por contarnos cómo te fue. Queremos ayudarte con lo que nos comentaste.`;
  return `https://wa.me/${completo}?text=${encodeURIComponent(mensaje)}`;
}

export function RespuestasPorPersona({ surveyId, respuestas, preguntas }: { surveyId: string; respuestas: RespuestaIndividual[]; preguntas: SurveyQuestion[] }): JSX.Element {
  const [filtro, setFiltro] = useState<Filtro>(() => (respuestas.some((respuesta) => requiereAtencion(respuesta) && !respuesta.attendedAt) ? 'pendientes' : 'todas'));
  const queryClient = useQueryClient();
  const atender = useMutation({
    mutationFn: ({ id, atendida }: { id: string; atendida: boolean }) => api.patch(`/surveys/${encodeURIComponent(surveyId)}/responses/${encodeURIComponent(id)}/attention`, { atendida }),
    onSuccess: (_datos, { atendida }) => { triggerToast(atendida ? 'Marcada como atendida' : 'Vuelve a quedar por atender'); void queryClient.invalidateQueries({ queryKey: ['surveys', surveyId, 'results'] }); },
    onError: (error: Error) => triggerToast(`No se pudo actualizar: ${error.message}`, 'error'),
  });
  const [busqueda, setBusqueda] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);
  const porId = useMemo(() => new Map(preguntas.map((pregunta) => [pregunta.id, pregunta])), [preguntas]);
  const idDe = (dato: string) => preguntas.find((pregunta) => pregunta.dato === dato)?.id;

  const contacto = (respuesta: RespuestaIndividual) => {
    const leer = (dato: string) => { const id = idDe(dato); const valor = id ? respuesta.answers[id] : undefined; return typeof valor === 'string' && valor.trim() ? valor.trim() : null; };
    return {
      nombre: respuesta.respondentName || leer('nombre'),
      correo: respuesta.respondentEmail || leer('correo'),
      telefono: leer('telefono'),
      rut: leer('rut'),
      nacimiento: leer('nacimiento'),
    };
  };

  const pendientes = respuestas.filter((respuesta) => requiereAtencion(respuesta) && !respuesta.attendedAt).length;
  const conMensaje = respuestas.filter((respuesta) => respuesta.teamMessage).length;
  const bajas = respuestas.filter((respuesta) => respuesta.rating !== null && respuesta.rating <= 3).length;
  const conContacto = respuestas.filter((respuesta) => { const c = contacto(respuesta); return c.correo || c.telefono; }).length;
  const texto = busqueda.trim().toLocaleLowerCase('es');
  const visibles = respuestas
    .filter((respuesta) => {
      if (filtro === 'pendientes') return requiereAtencion(respuesta) && !respuesta.attendedAt;
      if (filtro === 'mensajes') return Boolean(respuesta.teamMessage);
      if (filtro === 'bajas') return respuesta.rating !== null && respuesta.rating <= 3;
      if (filtro === 'con-contacto') { const c = contacto(respuesta); return Boolean(c.correo || c.telefono); }
      return true;
    })
    .filter((respuesta) => !texto || [respuesta.teamMessage, ...Object.values(respuesta.answers), respuesta.respondentName, respuesta.respondentEmail]
      .some((valor) => valor !== null && valor !== undefined && String(valor).toLocaleLowerCase('es').includes(texto)))
    // Los mensajes primero dentro de cualquier filtro: son lo que alguien tiene que contestar.
    .sort((a, b) => Number(Boolean(b.teamMessage)) - Number(Boolean(a.teamMessage)));

  return (
    <section className="respuestas-persona">
      <header>
        <h2>Qué contestó cada persona</h2>
        <input className="input respuestas-persona-buscar" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar en respuestas, nombres o mensajes" aria-label="Buscar respuestas" />
        <div className="respuestas-persona-filtros" role="group" aria-label="Filtrar respuestas">
          {([['pendientes', `Por atender (${pendientes})`], ['todas', `Todas (${respuestas.length})`], ['mensajes', `Con mensaje (${conMensaje})`], ['bajas', `3★ o menos (${bajas})`], ['con-contacto', `Con contacto (${conContacto})`]] as Array<[Filtro, string]>).map(([valor, etiqueta]) => (
            <button key={valor} type="button" aria-pressed={filtro === valor} className={filtro === valor ? 'active' : ''} onClick={() => setFiltro(valor)}>{etiqueta}</button>
          ))}
        </div>
      </header>

      {visibles.length === 0 ? <p className="page-subtitle">No hay respuestas con este filtro.</p> : (
        <ul>
          {visibles.map((respuesta) => {
            const c = contacto(respuesta);
            const detalle = Object.entries(respuesta.answers)
              .filter(([clave]) => porId.get(clave)?.type !== 'rating' && !porId.get(clave)?.dato)
              .map(([clave, valor]) => ({ pregunta: porId.get(clave)?.question ?? clave, valor }));
            const estaAbierta = abierta === respuesta.id;
            const whatsapp = c.telefono ? enlaceWhatsapp(c.telefono, c.nombre) : null;
            return (
              <li key={respuesta.id} className={`${respuesta.teamMessage ? 'con-mensaje' : ''} ${respuesta.rating !== null && respuesta.rating <= 3 ? 'nota-baja' : ''} ${respuesta.attendedAt ? 'atendida' : ''}`}>
                <button type="button" className="respuestas-persona-fila" aria-expanded={estaAbierta} onClick={() => setAbierta(estaAbierta ? null : respuesta.id)}>
                  <span className="respuestas-persona-nota" aria-label={respuesta.rating ? `${respuesta.rating} de 5` : 'Sin nota'}>
                    {respuesta.rating ? '★'.repeat(respuesta.rating) + '☆'.repeat(5 - respuesta.rating) : '—'}
                  </span>
                  <strong>{c.nombre || 'Anónimo'}</strong>
                  <small>
                    {new Date(respuesta.submittedAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}
                    {respuesta.completedAt ? '' : ' · dejó sólo la nota'}
                  </small>
                  <span className="respuestas-persona-abrir" aria-hidden="true">{estaAbierta ? '−' : '+'}</span>
                </button>
                {respuesta.teamMessage && <blockquote>«{respuesta.teamMessage}»</blockquote>}
                {(c.correo || whatsapp || requiereAtencion(respuesta)) && (
                  <div className="respuestas-persona-contactar">
                    {whatsapp && <a className="btn btn-primary btn-sm" href={whatsapp} target="_blank" rel="noopener noreferrer">Responder por WhatsApp</a>}
                    {c.correo && <a className="btn btn-outline btn-sm" href={`mailto:${c.correo}`}>{whatsapp ? 'Por correo' : 'Responder por correo'}</a>}
                    {requiereAtencion(respuesta) && (respuesta.attendedAt ? (
                      <span className="respuestas-persona-atendida">
                        ✓ Atendida{respuesta.attendedByName ? ` por ${respuesta.attendedByName}` : ''} · {new Date(respuesta.attendedAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                        <button type="button" disabled={atender.isPending} onClick={() => atender.mutate({ id: respuesta.id, atendida: false })}>Reabrir</button>
                      </span>
                    ) : (
                      <button type="button" className="btn btn-primary btn-sm" disabled={atender.isPending} onClick={() => atender.mutate({ id: respuesta.id, atendida: true })}>Marcar atendida</button>
                    ))}
                  </div>
                )}
                {estaAbierta && <dl>
                  {c.correo && <><dt>{DATOS_DE_CONTACTO.correo.etiqueta}</dt><dd><a href={`mailto:${c.correo}`}>{c.correo}</a></dd></>}
                  {c.telefono && <><dt>{DATOS_DE_CONTACTO.telefono.etiqueta}</dt><dd>{c.telefono}</dd></>}
                  {c.rut && <><dt>{DATOS_DE_CONTACTO.rut.etiqueta}</dt><dd>{c.rut}</dd></>}
                  {c.nacimiento && <><dt>{DATOS_DE_CONTACTO.nacimiento.etiqueta}</dt><dd>{new Date(`${c.nacimiento}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</dd></>}
                  {respuesta.privacyConsentAt && <><dt>Aceptó uso de datos</dt><dd>{new Date(respuesta.privacyConsentAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}</dd></>}
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
