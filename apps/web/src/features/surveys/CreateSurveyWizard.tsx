/**
 * @fileoverview Asistente de 5 pasos para crear, editar o duplicar una encuesta.
 *
 * Con `?id=<surveyId>` edita y guarda con `PUT`; con `?duplicar=<surveyId>` copia una existente
 * como encuesta nueva. Los pasos de inicio, preguntas y diseño muestran al lado cómo se verá la
 * página pública, en escritorio o celular.
 */

import { useEffect, useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WizardProgress, type WizardStepDescriptor } from '../../shared/WizardProgress';
import { PageHero } from '../../shared/PageHero';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { ImageUpload } from '../../shared/ImageUpload';
import { triggerToast } from '../../shared/toast-events';
import { useCreateSurvey, useSurvey, useUpdateSurvey } from './useSurveys';
import { api } from '../../core/api';
import type { QuestionType, Survey, SurveyContactField, SurveyDistributionChannel, SurveyQuestion, SurveyType } from '@espartanos/shared';
import { aplicarEdicionDePreguntas, DATOS_DE_CONTACTO, ORDEN_DE_DATOS, ordenarParaMostrar, preguntasVisibles } from '@espartanos/shared';
import { CampoDeEncuesta } from './CampoDeEncuesta';
import { estiloDeEncuesta } from './estilo-de-encuesta';
import { PLANTILLAS, preguntaDeDato, preguntasDePlantilla } from './plantillas-de-encuesta';
import './surveys.css';

const STEPS: WizardStepDescriptor[] = [
  { id: 'start', label: 'Inicio' },
  { id: 'questions', label: 'Preguntas' },
  { id: 'design', label: 'Diseño' },
  { id: 'distribution', label: 'Distribución' },
  { id: 'review', label: 'Revisión' },
];

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  nps: 'Recomendación (0-10)',
  rating: 'Estrellas (1-5)',
  text: 'Texto libre',
  'multiple-choice': 'Opción múltiple',
};

const DISTRIBUTION_LABELS: Record<SurveyDistributionChannel, { label: string; description: string }> = {
  email: { label: 'Correo', description: 'Envía el enlace a una lista de destinatarios.' },
  qr: { label: 'Código QR', description: 'Para imprimir o mostrar en el local, sin destinatarios previos.' },
  link: { label: 'Enlace directo', description: 'Comparte una URL abierta por cualquier canal propio.' },
};

const DATOS: SurveyContactField[] = ORDEN_DE_DATOS;

function blankQuestion(): SurveyQuestion {
  return { id: crypto.randomUUID(), type: 'rating', question: '', required: true };
}

/** Forma comparable de las preguntas: ignora campos vacíos que el servidor puede devolver como null. */
function firmaDePreguntas(questions: SurveyQuestion[]): string {
  return JSON.stringify(questions.map((q) => ({
    id: q.id, type: q.type, question: q.question.trim(), required: Boolean(q.required), dato: q.dato ?? null, archivada: Boolean(q.archivada), sensible: Boolean(q.sensible),
    options: q.type === 'multiple-choice' ? (q.options ?? []).map((o) => o.trim()).filter(Boolean) : [],
    mostrarSi: q.mostrarSi?.preguntaId ? { p: q.mostrarSi.preguntaId, v: [...q.mostrarSi.valores].sort() } : null,
  })));
}

interface WizardState {
  plantilla: string;
  title: string;
  type: SurveyType;
  clientId: string;
  questions: SurveyQuestion[];
  distribution: SurveyDistributionChannel[];
  recipients: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  backgroundMode: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: string;
  backgroundImage: string;
  backgroundOpacity: string;
  textColor: string;
  fontFamily: string;
  logoUrl: string;
  welcome: string;
  ga4MeasurementId: string;
  googleReviewUrl: string;
  /** Interruptor de la invitación a reseñar, para poder encenderla antes de tener el enlace. */
  pideResena: boolean;
  googleReviewMinRating: number;
  googleReviewLowMsg: string;
}

function blankState(): WizardState {
  return {
    plantilla: '',
    title: '',
    type: 'customer',
    clientId: '',
    questions: [blankQuestion()],
    distribution: [],
    recipients: '',
    primaryColor: '#0fb9b1',
    accentColor: '#ec0b61',
    backgroundColor: '#f6f4f5',
    backgroundMode: 'color',
    gradientFrom: '#f6f4f5',
    gradientTo: '#e7f8f6',
    gradientAngle: '135',
    backgroundImage: '',
    backgroundOpacity: '88',
    textColor: '#151317',
    fontFamily: 'system-ui',
    logoUrl: '',
    welcome: '',
    ga4MeasurementId: '',
    googleReviewUrl: '',
    pideResena: false,
    googleReviewMinRating: 4,
    googleReviewLowMsg: '',
  };
}

function stateFromSurvey(survey: Survey): WizardState {
  const design = survey.designConfig ?? {};
  const base = blankState();
  return {
    ...base,
    plantilla: design.plantilla ?? '',
    title: survey.title,
    type: survey.type,
    clientId: survey.clientId ?? '',
    questions: survey.questions.length ? survey.questions : [blankQuestion()],
    distribution: survey.distribution ?? [],
    recipients: (survey.recipients ?? []).join(', '),
    primaryColor: design.primaryColor ?? base.primaryColor,
    accentColor: design.accentColor ?? base.accentColor,
    backgroundColor: design.backgroundColor ?? base.backgroundColor,
    backgroundMode: design.backgroundMode ?? (design.backgroundImage ? 'image' : 'color'),
    gradientFrom: design.gradientFrom ?? base.gradientFrom,
    gradientTo: design.gradientTo ?? base.gradientTo,
    gradientAngle: design.gradientAngle ?? base.gradientAngle,
    backgroundImage: design.backgroundImage ?? '',
    backgroundOpacity: design.backgroundOpacity ?? base.backgroundOpacity,
    textColor: design.textColor ?? base.textColor,
    fontFamily: design.fontFamily ?? base.fontFamily,
    logoUrl: design.logoUrl ?? '',
    welcome: design.welcome ?? '',
    ga4MeasurementId: survey.ga4MeasurementId ?? '',
    googleReviewUrl: survey.googleReview?.url ?? '',
    pideResena: Boolean(survey.googleReview?.url),
    googleReviewMinRating: survey.googleReview?.minRating ?? 4,
    googleReviewLowMsg: survey.googleReview?.lowRatingMessage ?? '',
  };
}

function designFromState(state: WizardState): NonNullable<Survey['designConfig']> {
  return {
    primaryColor: state.primaryColor,
    accentColor: state.accentColor,
    backgroundColor: state.backgroundColor,
    backgroundMode: state.backgroundMode,
    ...(state.backgroundMode === 'gradient' ? { gradientFrom: state.gradientFrom, gradientTo: state.gradientTo, gradientAngle: state.gradientAngle } : {}),
    backgroundImage: state.backgroundMode === 'image' ? state.backgroundImage || undefined : undefined,
    backgroundOpacity: state.backgroundOpacity,
    textColor: state.textColor,
    fontFamily: state.fontFamily,
    logoUrl: state.logoUrl || undefined,
    welcome: state.welcome.trim() || undefined,
    plantilla: state.plantilla || undefined,
  };
}

/** Valores que puede tomar una pregunta para usarla en una regla. */
function valoresPosibles(pregunta: SurveyQuestion): Array<{ valor: string; etiqueta: string }> {
  if (pregunta.dato || pregunta.archivada) return [];
  if (pregunta.type === 'rating') return ['1', '2', '3', '4', '5'].map((valor) => ({ valor, etiqueta: `${valor}★` }));
  if (pregunta.type === 'nps') return Array.from({ length: 11 }, (_, i) => ({ valor: String(i), etiqueta: String(i) }));
  if (pregunta.type === 'multiple-choice') return (pregunta.options ?? []).filter((o) => o.trim()).map((valor) => ({ valor, etiqueta: valor }));
  return [];
}

/** Atajos para elegir valores de una regla sin marcar uno por uno. */
function atajosDeValores(pregunta: SurveyQuestion): Array<{ etiqueta: string; valores: string[] }> {
  if (pregunta.type === 'rating') return [{ etiqueta: 'Nota baja (1-3)', valores: ['1', '2', '3'] }, { etiqueta: 'Nota alta (4-5)', valores: ['4', '5'] }];
  if (pregunta.type === 'nps') return [{ etiqueta: 'Detractores (0-6)', valores: ['0', '1', '2', '3', '4', '5', '6'] }, { etiqueta: 'Pasivos (7-8)', valores: ['7', '8'] }, { etiqueta: 'Promotores (9-10)', valores: ['9', '10'] }];
  return [];
}

/** Vista previa de la página pública, interactiva: se pueden probar las reglas. */
function VistaPrevia({ state }: { state: WizardState }) {
  const [modo, setModo] = useState<'escritorio' | 'celular'>('celular');
  const [respuestas, setRespuestas] = useState<Record<string, string | number>>({});
  // Mismo orden que la página real: con estrellas, la nota va sola primero y después los datos y el resto.
  const ordenadas = ordenarParaMostrar(preguntasVisibles(state.questions.filter((q) => q.question.trim()), respuestas));
  const nota = ordenadas.find((q) => q.type === 'rating');
  const visibles = nota ? [nota, ...ordenadas.filter((q) => q.id !== nota.id)] : ordenadas;
  const pideDatos = state.questions.some((q) => q.dato);
  return (
    <aside className="survey-preview" aria-label="Vista previa">
      <div className="survey-preview-bar">
        <strong>Vista previa</strong>
        <div role="group" aria-label="Tamaño de la vista previa">
          {(['celular', 'escritorio'] as const).map((valor) => (
            <button key={valor} type="button" aria-pressed={modo === valor} className={modo === valor ? 'active' : ''} onClick={() => setModo(valor)}>{valor === 'celular' ? 'Celular' : 'Escritorio'}</button>
          ))}
        </div>
      </div>
      <div className={`survey-preview-frame ${modo}`}>
        <div className="public-survey-page survey-preview-page" style={estiloDeEncuesta(designFromState(state))}>
          <div className="public-survey-card">
            {state.logoUrl ? <img className="public-survey-logo" src={state.logoUrl} alt="" /> : null}
            <span className="public-survey-eyebrow">Tu opinión</span>
            <h1>{state.title || 'Nombre de la encuesta'}</h1>
            <p>{state.welcome || 'Tu opinión ayuda a mejorar el servicio.'}</p>
            <div className="public-survey-questions">
              {visibles.map((question) => (
                <CampoDeEncuesta key={question.id} question={question} estrellas value={respuestas[question.id]} onChange={(value) => setRespuestas((r) => ({ ...r, [question.id]: value }))} />
              ))}
            </div>
            {pideDatos ? <div className="public-survey-aceptacion"><label><input type="checkbox" disabled /><span>Acepto que la empresa use los datos que dejo en esta encuesta… (el texto se completa con sus datos legales)</span></label></div> : null}
            <button type="button" className="btn btn-primary btn-block public-survey-submit">Enviar respuesta</button>
          </div>
        </div>
      </div>
      <small>Toca las respuestas para probar qué preguntas aparecen.</small>
    </aside>
  );
}

type SetState = (updater: (current: WizardState) => WizardState) => void;

/** Paso 1: público, empresa, plantilla, nombre y bienvenida. */
function PasoInicio({ state, setState, clients, conRespuestas, isEdit }: {
  state: WizardState; setState: SetState; clients: Array<{ id: string; name: string }>; conRespuestas: boolean; isEdit: boolean;
}) {
  const plantillas = PLANTILLAS.filter((plantilla) => plantilla.publico === state.type);
  const aplicar = (id: string) => {
    const plantilla = PLANTILLAS.find((item) => item.id === id);
    setState((current) => plantilla
      ? { ...current, plantilla: id, questions: preguntasDePlantilla(plantilla), title: current.title || plantilla.titulo, welcome: current.welcome || plantilla.bienvenida }
      : { ...current, plantilla: '', questions: [blankQuestion()] });
  };
  return (
    <div className="wizard-step-body">
      <div className="survey-type-options" role="radiogroup" aria-label="Público">
        <button type="button" role="radio" aria-checked={state.type === 'customer'} className={state.type === 'customer' ? 'active' : ''} onClick={() => setState((c) => ({ ...c, type: 'customer' }))}>
          <strong>Clientes</strong><span>Encuesta pública para clientes o asistentes.</span>
        </button>
        <button type="button" role="radio" aria-checked={state.type === 'internal'} className={state.type === 'internal' ? 'active' : ''} onClick={() => setState((c) => ({ ...c, type: 'internal', clientId: '' }))}>
          <strong>Equipo</strong><span>Encuesta interna, para las personas de Espartanos.</span>
        </button>
      </div>
      {state.type === 'customer' && <label>Empresa dueña de la encuesta
        <select className="input" value={state.clientId} onChange={(event) => setState((c) => ({ ...c, clientId: event.target.value }))} required>
          <option value="">Selecciona una empresa</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <small>La encuesta y sus resultados quedan aislados para esta empresa. Sus datos legales se usan en la aceptación.</small>
      </label>}

      {conRespuestas && <p className="survey-edicion-nota">Esta encuesta ya tiene respuestas: las plantillas no se ofrecen porque reemplazarían sus preguntas. Puedes editar cada pregunta en el paso siguiente sin perder nada.</p>}
      {!conRespuestas && (
        <fieldset className="survey-plantillas">
          <legend>¿Por dónde empiezas?{isEdit ? ' (reemplaza las preguntas actuales)' : ''}</legend>
          <div>
            {plantillas.map((plantilla) => (
              <button key={plantilla.id} type="button" aria-pressed={state.plantilla === plantilla.id} className={state.plantilla === plantilla.id ? 'active' : ''} onClick={() => aplicar(plantilla.id)}>
                <strong>{plantilla.nombre}</strong><span>{plantilla.descripcion}</span>
              </button>
            ))}
            <button type="button" aria-pressed={state.plantilla === ''} className={state.plantilla === '' ? 'active' : ''} onClick={() => aplicar('')}>
              <strong>Desde cero</strong><span>Una pregunta en blanco para armarla a tu manera.</span>
            </button>
          </div>
        </fieldset>
      )}

      <label>Nombre de la encuesta
        <input className="input" required value={state.title} onChange={(event) => setState((c) => ({ ...c, title: event.target.value }))} placeholder="Ej. Satisfacción clientes agosto" />
      </label>
      <label>Mensaje de bienvenida
        <textarea className="input" rows={3} maxLength={400} value={state.welcome} onChange={(event) => setState((c) => ({ ...c, welcome: event.target.value }))} placeholder="Ej. Gracias por visitarnos. ¿Nos cuentas cómo te fue? Toma menos de un minuto." />
        <small>Aparece bajo el título. Corto y cercano: di cuánto demora.</small>
      </label>
    </div>
  );
}

/** Paso 2: datos de quien responde y preguntas con reglas. */
function PasoPreguntas({ questions, onChange, conRespuestas, idsGuardados, state, setState }: { state: WizardState; setState: SetState; questions: SurveyQuestion[]; onChange: (next: SurveyQuestion[]) => void; conRespuestas: boolean; idsGuardados: Set<string> }) {
  const set = (patch: Partial<WizardState>) => setState((c) => ({ ...c, ...patch }));
  const preguntas = questions.filter((q) => !q.dato);
  const datos = questions.filter((q) => q.dato);
  /** Si una pregunta pudo recibir respuestas: entonces se archiva en vez de quitarse. */
  const tieneRespuestas = (id: string) => conRespuestas && idsGuardados.has(id);
  const activas = preguntas.filter((q) => !q.archivada).length;
  const conDatos = (lista: SurveyQuestion[]) => [...lista, ...datos];
  const update = (id: string, patch: Partial<SurveyQuestion>) => onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  // Quitar una pregunta también quita las reglas que dependían de ella. Con respuestas, se archiva.
  const remove = (id: string) => onChange((tieneRespuestas(id)
    ? questions.map((q) => (q.id === id ? { ...q, archivada: true } : q))
    : questions.filter((q) => q.id !== id)).map((q) => (q.mostrarSi?.preguntaId === id ? { ...q, mostrarSi: undefined } : q)));
  const restaurar = (id: string) => onChange(questions.map((q) => (q.id === id ? { ...q, archivada: undefined } : q)));
  const mover = (indice: number, delta: number) => {
    const lista = [...preguntas];
    const destino = indice + delta;
    if (destino < 0 || destino >= lista.length) return;
    [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
    // Una regla sólo puede depender de una pregunta anterior.
    const posicion = new Map(lista.map((q, i) => [q.id, i]));
    onChange(conDatos(lista.map((q, i) => (q.mostrarSi && (posicion.get(q.mostrarSi.preguntaId) ?? i) >= i ? { ...q, mostrarSi: undefined } : q))));
  };
  const alternarDato = (dato: SurveyContactField) => {
    const existente = datos.find((q) => q.dato === dato);
    if (existente?.archivada) { restaurar(existente.id); return; }
    if (existente && tieneRespuestas(existente.id)) { remove(existente.id); return; }
    if (existente) onChange(questions.filter((q) => q.id !== existente.id));
    else onChange([...preguntas, ...[...datos, preguntaDeDato(dato, false)].sort((a, b) => DATOS.indexOf(a.dato!) - DATOS.indexOf(b.dato!))]);
  };

  return (
    <div className="wizard-step-body">
      {conRespuestas && <div className="alert alert-info survey-edicion-nota">Esta encuesta ya tiene respuestas y se puede editar sin perderlas: cambiar la redacción, agregar o reordenar mantiene lo contestado; <strong>quitar archiva</strong> la pregunta (deja de mostrarse, pero sus respuestas siguen en resultados). El tipo de una pregunta con respuestas no se cambia. Todo lo que cambies queda en el historial.</div>}
      <fieldset className="questions-editor-fieldset">
        <section className="survey-datos">
          <header>
            <strong>Datos de quien responde</strong>
            <small>Opcional. Si pides alguno, se agrega sola la aceptación de uso de datos con los datos legales de la empresa.</small>
          </header>
          <div className="survey-datos-lista">
            {DATOS.map((dato) => {
              const pregunta = datos.find((q) => q.dato === dato && !q.archivada);
              return (
                <div key={dato} className={`survey-dato ${pregunta ? 'active' : ''}`}>
                  <label className="survey-dato-principal"><input type="checkbox" checked={Boolean(pregunta)} onChange={() => alternarDato(dato)} /> {DATOS_DE_CONTACTO[dato].etiqueta}</label>
                  {pregunta && <label className="survey-dato-obligatorio"><input type="checkbox" checked={pregunta.required} onChange={(e) => update(pregunta.id, { required: e.target.checked })} /> Obligatorio</label>}
                </div>
              );
            })}
          </div>
        </section>

        <div className="questions-editor">
          {preguntas.map((question, index) => {
            if (question.archivada) {
              return (
                <article className="question-card is-archivada" key={question.id}>
                  <header>
                    <span className="question-index">Archivada · sus respuestas se conservan</span>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => restaurar(question.id)}>Restaurar</button>
                  </header>
                  <p>{question.question}</p>
                </article>
              );
            }
            const anteriores = preguntas.slice(0, index).filter((q) => valoresPosibles(q).length > 0);
            const origen = anteriores.find((q) => q.id === question.mostrarSi?.preguntaId);
            const valores = question.mostrarSi?.valores ?? [];
            return (
              <article className="question-card" key={question.id}>
                <header>
                  <span className="question-index">Pregunta {index + 1}{question.mostrarSi ? ' · condicional' : ''}</span>
                  <div className="question-card-acciones">
                    <button type="button" className="btn btn-outline btn-sm" aria-label="Subir pregunta" disabled={index === 0} onClick={() => mover(index, -1)}>↑</button>
                    <button type="button" className="btn btn-outline btn-sm" aria-label="Bajar pregunta" disabled={index === preguntas.length - 1} onClick={() => mover(index, 1)}>↓</button>
                    <button type="button" className="btn btn-outline btn-sm" disabled={activas <= 1} title={tieneRespuestas(question.id) ? 'Deja de mostrarse; sus respuestas se conservan' : undefined} onClick={() => remove(question.id)}>{tieneRespuestas(question.id) ? 'Archivar' : 'Quitar'}</button>
                  </div>
                </header>
                <label>Enunciado
                  <input className="input" required value={question.question} onChange={(event) => update(question.id, { question: event.target.value })} placeholder="Ej. ¿Cómo fue tu visita?" />
                </label>
                <div className="form-row">
                  <label>Tipo de pregunta
                    <select className="input" value={question.type} disabled={tieneRespuestas(question.id)} title={tieneRespuestas(question.id) ? 'Ya tiene respuestas: agrega una pregunta nueva para otro tipo' : undefined} onChange={(event) => {
                      const type = event.target.value as QuestionType;
                      // Cambiar el tipo invalida las reglas que dependían de sus valores.
                      onChange(questions.map((q) => q.id === question.id
                        ? { ...q, type, options: type === 'multiple-choice' ? q.options ?? ['', ''] : undefined }
                        : q.mostrarSi?.preguntaId === question.id ? { ...q, mostrarSi: undefined } : q));
                    }}>
                      {(Object.entries(QUESTION_TYPE_LABELS) as Array<[QuestionType, string]>).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                    </select>
                  </label>
                  <label className="toggle-row">
                    <input type="checkbox" checked={question.required} onChange={(event) => update(question.id, { required: event.target.checked })} />
                    Obligatoria
                  </label>
                  <label className="toggle-row" title="Salud, alergias u otro dato sensible: quien responda deberá autorizarlo expresamente">
                    <input type="checkbox" checked={Boolean(question.sensible)} onChange={(event) => update(question.id, { sensible: event.target.checked })} />
                    Dato sensible
                  </label>
                </div>
                {question.type === 'multiple-choice' && (
                  <div className="choice-options-editor">
                    <span>Opciones</span>
                    {(question.options ?? []).map((option, optionIndex) => (
                      <div className="choice-option-row" key={optionIndex}>
                        <input className="input" required value={option} placeholder={`Opción ${optionIndex + 1}`} onChange={(event) => {
                          const options = [...(question.options ?? [])];
                          options[optionIndex] = event.target.value;
                          update(question.id, { options });
                        }} />
                        <button type="button" className="btn btn-outline btn-sm" disabled={(question.options?.length ?? 0) <= 2} onClick={() => update(question.id, { options: (question.options ?? []).filter((_, i) => i !== optionIndex) })}>Quitar</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => update(question.id, { options: [...(question.options ?? []), ''] })}>+ Agregar opción</button>
                  </div>
                )}
                {anteriores.length > 0 && (
                  <div className="question-regla">
                    <label>Cuándo mostrarla
                      <select className="input" value={question.mostrarSi?.preguntaId ?? ''} onChange={(event) => update(question.id, { mostrarSi: event.target.value ? { preguntaId: event.target.value, valores: [] } : undefined })}>
                        <option value="">Siempre</option>
                        {anteriores.map((q) => <option key={q.id} value={q.id}>Según «{q.question || 'pregunta sin enunciado'}»</option>)}
                      </select>
                    </label>
                    {origen && (
                      <div className="question-regla-valores">
                        <span>Mostrar si respondió:</span>
                        {atajosDeValores(origen).length > 0 && <div>
                          {atajosDeValores(origen).map((atajo) => {
                            const activo = atajo.valores.length === valores.length && atajo.valores.every((v) => valores.includes(v));
                            return <button key={atajo.etiqueta} type="button" aria-pressed={activo} className={`survey-chip ${activo ? 'active' : ''}`} onClick={() => update(question.id, { mostrarSi: { preguntaId: origen.id, valores: atajo.valores } })}>{atajo.etiqueta}</button>;
                          })}
                        </div>}
                        <div>
                          {valoresPosibles(origen).map(({ valor, etiqueta }) => {
                            const activo = valores.includes(valor);
                            return <button key={valor} type="button" aria-pressed={activo} className={`survey-chip ${activo ? 'active' : ''}`} onClick={() => update(question.id, { mostrarSi: { preguntaId: origen.id, valores: activo ? valores.filter((v) => v !== valor) : [...valores, valor] } })}>{etiqueta}</button>;
                          })}
                        </div>
                        {valores.length === 0 && <small className="text-danger">Elige al menos una respuesta, o vuelve a «Siempre».</small>}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <button type="button" className="btn btn-outline" onClick={() => onChange(conDatos([...preguntas, blankQuestion()]))}>+ Agregar pregunta</button>
      </fieldset>

      <fieldset className="survey-resenas">
        <legend>Al terminar la encuesta</legend>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={state.googleReviewUrl.trim().length > 0 || state.pideResena}
            onChange={(e) => set(e.target.checked ? { pideResena: true } : { pideResena: false, googleReviewUrl: '' })}
          /> Invitar a dejar una reseña en Google
        </label>
        {(state.pideResena || state.googleReviewUrl.trim()) ? <>
          <p className="survey-resenas-ayuda">A quien califique {state.googleReviewMinRating} o más se le ofrece el enlace de Google. A quien califique menos se le muestra tu mensaje, y su respuesta queda para el equipo.</p>
          <label>Enlace para dejar la reseña
            <small>Sale del perfil del local en Google: «Pedir reseñas» copia un enlace corto.</small>
            <input className="input" value={state.googleReviewUrl} onChange={(e) => set({ googleReviewUrl: e.target.value })} placeholder="https://g.page/r/..." />
          </label>
          <div className="form-row">
            <label>Nota desde la que se pide la reseña
              <input className="input" type="number" min={1} max={5} value={state.googleReviewMinRating} onChange={(e) => set({ googleReviewMinRating: Number(e.target.value) })} />
            </label>
          </div>
          <label>Mensaje si la calificación es baja
            <textarea className="input" rows={2} value={state.googleReviewLowMsg} onChange={(e) => set({ googleReviewLowMsg: e.target.value })} placeholder="Gracias por avisarnos. Revisaremos tu caso." />
          </label>
          {state.pideResena && !state.googleReviewUrl.trim() && <p className="survey-resenas-falta">Falta el enlace: sin él no se le ofrece la reseña a nadie.</p>}
        </> : <p className="survey-resenas-ayuda">Apagado: al terminar sólo se agradece la respuesta.</p>}
      </fieldset>
    </div>
  );
}

/** Paso 3: diseño de la página pública. */
function PasoDiseno({ state, setState }: { state: WizardState; setState: SetState }) {
  const set = (patch: Partial<WizardState>) => setState((c) => ({ ...c, ...patch }));
  return (
    <div className="wizard-step-body">
      <div className="survey-design-grid">
        <label>Color principal<input type="color" value={state.primaryColor} onChange={(e) => set({ primaryColor: e.target.value })} /></label>
        <label>Acento<input type="color" value={state.accentColor} onChange={(e) => set({ accentColor: e.target.value })} /></label>
        <label>Texto<input type="color" value={state.textColor} onChange={(e) => set({ textColor: e.target.value })} /></label>
      </div>
      <label>Tipo de letra<select className="input" value={state.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}><option value="system-ui">Sistema</option><option value="Inter, sans-serif">Inter</option><option value="Georgia, serif">Georgia</option></select></label>

      <fieldset className="survey-fondo">
        <legend>Fondo</legend>
        <div className="survey-fondo-modos" role="radiogroup" aria-label="Tipo de fondo">
          {([['color', 'Color'], ['gradient', 'Degradado'], ['image', 'Imagen']] as const).map(([valor, etiqueta]) => (
            <button key={valor} type="button" role="radio" aria-checked={state.backgroundMode === valor} className={state.backgroundMode === valor ? 'active' : ''} onClick={() => set({ backgroundMode: valor })}>{etiqueta}</button>
          ))}
        </div>
        {state.backgroundMode === 'color' && <label className="survey-fondo-color">Color de fondo<input type="color" value={state.backgroundColor} onChange={(e) => set({ backgroundColor: e.target.value })} /></label>}
        {state.backgroundMode === 'gradient' && <>
          <div className="survey-design-grid">
            <label>Desde<input type="color" value={state.gradientFrom} onChange={(e) => set({ gradientFrom: e.target.value })} /></label>
            <label>Hasta<input type="color" value={state.gradientTo} onChange={(e) => set({ gradientTo: e.target.value })} /></label>
          </div>
          <label>Dirección
            <select className="input" value={state.gradientAngle} onChange={(e) => set({ gradientAngle: e.target.value })}>
              <option value="180">De arriba hacia abajo</option>
              <option value="90">De izquierda a derecha</option>
              <option value="135">Diagonal</option>
              <option value="45">Diagonal inversa</option>
            </select>
          </label>
          <div className="survey-fondo-muestras" aria-label="Combinaciones sugeridas">
            {[['#f6f4f5', '#e7f8f6'], ['#fff4ea', '#ffe1ec'], ['#eef2ff', '#e0f7fa'], ['#1f1b24', '#3b2340']].map(([desde, hasta]) => (
              <button key={desde + hasta} type="button" aria-label={`Degradado de ${desde} a ${hasta}`} style={{ background: `linear-gradient(135deg, ${desde}, ${hasta})` }} onClick={() => set({ gradientFrom: desde, gradientTo: hasta })} />
            ))}
          </div>
        </>}
        {state.backgroundMode === 'image' && <>
          <ImageUpload label="Imagen de fondo" value={state.backgroundImage} onChange={(url) => set({ backgroundImage: url })} placeholder="https://..." maxSizeMB={5} maxWidth={1920} clientId={state.clientId || undefined} />
          <label>Claridad sobre la imagen ({state.backgroundOpacity}%)<input type="range" min="0" max="100" value={state.backgroundOpacity} onChange={(e) => set({ backgroundOpacity: e.target.value })} /><small>Más claridad hace que las preguntas se lean mejor sobre la foto.</small></label>
        </>}
      </fieldset>

      <ImageUpload label="Logo de la encuesta" value={state.logoUrl} onChange={(url) => set({ logoUrl: url })} placeholder="https://..." maxSizeMB={3} maxWidth={480} clientId={state.clientId || undefined} />
    </div>
  );
}

/** Paso 4: canal de distribución y, si aplica, destinatarios explícitos. */
function DistributionSelector({ selected, recipients, onToggleChannel, onRecipientsChange, ga4, onGa4Change }: {
  selected: SurveyDistributionChannel[]; recipients: string;
  onToggleChannel: (channel: SurveyDistributionChannel) => void; onRecipientsChange: (value: string) => void;
  ga4: string; onGa4Change: (value: string) => void;
}) {
  const ga4Valido = !ga4 || /^G-[A-Z0-9]{4,20}$/i.test(ga4);
  return (
    <div className="wizard-step-body">
      <p className="page-subtitle">Define cómo se compartirá. Correo registra destinatarios; enlace y QR quedan como canales de publicación.</p>
      <div className="distribution-options">
        {(Object.entries(DISTRIBUTION_LABELS) as Array<[SurveyDistributionChannel, { label: string; description: string }]>).map(([channel, meta]) => (
          <label key={channel} className={`distribution-option ${selected.includes(channel) ? 'active' : ''}`}>
            <input type="checkbox" checked={selected.includes(channel)} onChange={() => onToggleChannel(channel)} />
            <div><strong>{meta.label}</strong><span>{meta.description}</span></div>
          </label>
        ))}
      </div>
      {selected.includes('email') && (
        <label>Destinatarios (correos separados por coma)
          <textarea className="input" rows={3} value={recipients} onChange={(event) => onRecipientsChange(event.target.value)} placeholder="ana@cliente.cl, juan@cliente.cl" />
        </label>
      )}
      <section className="survey-medicion">
        <header><strong>Medición</strong><small>Cada canal comparte su propio enlace con origen (WhatsApp, Instagram, QR…). Los resultados cuentan de dónde llegó cada respuesta, con o sin Google Analytics.</small></header>
        <label>ID de medición de Google Analytics 4 (opcional)
          <input className="input" value={ga4} aria-invalid={!ga4Valido} onChange={(e) => onGa4Change(e.target.value.trim().toUpperCase())} placeholder="G-XXXXXXXXXX" />
          <small className={ga4Valido ? '' : 'text-danger'}>{ga4Valido ? 'Envía a GA4 las visitas y respuestas con su canal. Lo encuentras en Analytics → Administrar → Flujos de datos.' : 'Debe tener el formato G-XXXXXXXXXX'}</small>
        </label>
      </section>
    </div>
  );
}

/** Paso 5: resumen antes de guardar. */
function ReviewAndSubmit({ state, isEdit, cambiosPrevistos, errorDeEdicion }: { state: WizardState; isEdit: boolean; cambiosPrevistos: string[]; errorDeEdicion?: string }) {
  const recipientCount = state.recipients.split(',').map((value) => value.trim()).filter(Boolean).length;
  const preguntas = state.questions.filter((q) => !q.dato && !q.archivada);
  const datos = state.questions.filter((q) => q.dato && !q.archivada);
  const porId = new Map(state.questions.map((q) => [q.id, q]));
  const condicionales = preguntas.filter((q) => q.mostrarSi).length;
  return (
    <div className="wizard-step-body">
      <p className="page-subtitle">{isEdit ? 'Revisa los cambios antes de guardar.' : 'Revisa la encuesta antes de crearla como borrador.'}</p>
      {isEdit && (errorDeEdicion
        ? <div className="alert alert-error" role="alert">{errorDeEdicion}</div>
        : <section className="survey-cambios-previstos">
          <strong>{cambiosPrevistos.length ? `Lo que cambiará (${cambiosPrevistos.length})` : 'No hay cambios todavía'}</strong>
          {cambiosPrevistos.length > 0 && <ul>{cambiosPrevistos.map((cambio) => <li key={cambio}>{cambio}</li>)}</ul>}
          <small>Queda registrado en el historial de la encuesta, con fecha y quién lo hizo.</small>
        </section>)}
      <div className="review-summary">
        <div><span>Nombre</span><strong>{state.title || 'Sin nombre aún'}</strong></div>
        <div><span>Público</span><strong>{state.type === 'internal' ? 'Equipo' : 'Clientes'}</strong></div>
        <div><span>Preguntas</span><strong>{preguntas.length}{condicionales ? ` (${condicionales} condicionales)` : ''}</strong></div>
        <div><span>Datos pedidos</span><strong>{datos.length ? datos.map((q) => DATOS_DE_CONTACTO[q.dato!].etiqueta + (q.required ? '*' : '')).join(', ') : 'Anónima'}</strong></div>
        <div><span>Medición</span><strong>{state.ga4MeasurementId ? 'GA4 configurado' : 'Sin GA4'}</strong></div>
        <div><span>Distribución</span><strong>{state.distribution.length ? state.distribution.map((channel) => DISTRIBUTION_LABELS[channel].label).join(', ') : 'Sin definir todavía'}</strong></div>
        {state.distribution.includes('email') && <div><span>Destinatarios</span><strong>{recipientCount}</strong></div>}
      </div>
      {!state.welcome.trim() && <div className="alert alert-info">No hay mensaje de bienvenida: se mostrará uno genérico.</div>}
      <ul className="review-checklist">
        {preguntas.map((question, index) => (
          <li key={question.id}>
            <strong>{index + 1}. {question.question || 'Pregunta sin enunciado'}</strong>
            <span>
              {QUESTION_TYPE_LABELS[question.type]}{question.required ? ' · Obligatoria' : ''}
              {question.mostrarSi ? ` · Sólo si «${porId.get(question.mostrarSi.preguntaId)?.question ?? '?'}» es ${question.mostrarSi.valores.join(', ')}` : ''}
            </span>
          </li>
        ))}
      </ul>
      <p className="page-subtitle">{isEdit ? 'Guardar no cambia el estado actual de la encuesta.' : 'La encuesta se crea como borrador; publícala desde el listado cuando esté lista.'}</p>
    </div>
  );
}

export function CreateSurveyWizard(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id') ?? undefined;
  const duplicarId = editId ? undefined : searchParams.get('duplicar') ?? undefined;
  const { data: existingSurvey, isLoading } = useSurvey(editId ?? duplicarId);
  const createMutation = useCreateSurvey();
  const updateMutation = useUpdateSurvey();
  const { data: clientsResponse } = useQuery<{ data?: Array<{ id: string; name: string; capabilities?: { surveys?: boolean } }> }>({
    queryKey: ['clients'], queryFn: () => api.get('/clients'),
  });
  // Sólo las empresas con Encuestas activo, más la ya elegida si se está editando una antigua.
  const clients = (clientsResponse?.data ?? []).filter((client) => client.capabilities?.surveys !== false || client.id === existingSurvey?.clientId);

  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(blankState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (existingSurvey && !hydrated) {
      const base = stateFromSurvey(existingSurvey);
      // Al duplicar, las preguntas conservan sus ids: son de otra encuesta y no chocan.
      setState(duplicarId ? { ...base, title: `${base.title} (copia)` } : base);
      setHydrated(true);
    }
  }, [existingSurvey, hydrated, duplicarId]);

  if ((editId || duplicarId) && isLoading) return <LoadingSpinner text="Cargando encuesta..." />;

  const conRespuestas = Boolean(editId && (existingSurvey?.responses ?? 0) > 0);
  const idsGuardados = new Set((existingSurvey?.questions ?? []).map((q) => q.id));
  // Mismo cálculo que hará el servidor: lo que se ve aquí es lo que queda en el historial.
  const edicionPrevista = editId && existingSurvey
    ? aplicarEdicionDePreguntas(existingSurvey.questions ?? [], ordenarParaMostrar(state.questions), conRespuestas, new Date().toISOString())
    : null;
  const cambiosPrevistos = [
    ...(edicionPrevista?.cambios ?? []),
    ...(existingSurvey && state.title.trim() !== existingSurvey.title ? [`Nombre: «${existingSurvey.title}» → «${state.title.trim()}»`] : []),
    ...(existingSurvey && state.welcome.trim() !== (existingSurvey.designConfig?.welcome ?? '') ? ['Mensaje de bienvenida actualizado'] : []),
  ];
  const reglasIncompletas = state.questions.some((q) => q.mostrarSi && q.mostrarSi.valores.length === 0);
  const stepReady: boolean[] = [
    Boolean(state.title.trim()) && (state.type !== 'customer' || Boolean(state.clientId)),
    state.questions.some((q) => !q.dato && !q.archivada)
      && state.questions.every((question) => question.question.trim() && (question.type !== 'multiple-choice' || (question.options ?? []).filter((option) => option.trim()).length >= 2))
      && !reglasIncompletas,
    true,
    !state.ga4MeasurementId || /^G-[A-Z0-9]{4,20}$/i.test(state.ga4MeasurementId),
    !edicionPrevista?.error,
  ];

  const mutation = editId ? updateMutation : createMutation;
  const submit = () => {
    const questions = ordenarParaMostrar(state.questions).map((question) => ({
      ...question,
      options: question.type === 'multiple-choice' ? (question.options ?? []).map((option) => option.trim()).filter(Boolean) : undefined,
      mostrarSi: question.mostrarSi?.valores.length ? question.mostrarSi : undefined,
    }));
    const recipients = state.recipients.split(',').map((value) => value.trim()).filter(Boolean);
    const googleReview = state.googleReviewUrl ? { url: state.googleReviewUrl, minRating: state.googleReviewMinRating, lowRatingMessage: state.googleReviewLowMsg || undefined } : undefined;
    const comun = {
      title: state.title.trim(), type: state.type, clientId: state.type === 'customer' ? state.clientId : undefined,
      distribution: state.distribution, recipients: recipients.length ? recipients : undefined,
      ga4MeasurementId: state.ga4MeasurementId.trim() || null, designConfig: designFromState(state), googleReview,
    };

    if (editId) {
      // Las preguntas viajan sólo si cambiaron: con respuestas el servidor no admite tocarlas, y
      // reenviarlas iguales hacía fallar el guardado de la bienvenida o el fondo.
      const preguntasCambiaron = !existingSurvey || firmaDePreguntas(questions) !== firmaDePreguntas(existingSurvey.questions ?? []);
      updateMutation.mutate(
        { id: editId, patch: { ...comun, ...(preguntasCambiaron ? { questions } : {}) } },
        { onSuccess: () => { triggerToast('Encuesta actualizada'); navigate('/surveys'); } },
      );
      return;
    }
    createMutation.mutate({ ...comun, questions }, { onSuccess: () => { triggerToast(duplicarId ? 'Copia creada como borrador' : 'Encuesta creada'); navigate('/surveys'); } });
  };

  const conVista = step <= 2;

  return (
    <div className="page survey-module">
      <PageHero
        eyebrow="MEDICIÓN"
        title={editId ? 'Editar encuesta' : duplicarId ? 'Duplicar encuesta' : 'Nueva encuesta'}
        subtitle="Inicio, preguntas, diseño, distribución y revisión."
      />
      <div className={`survey-editor ${conVista ? 'con-vista' : ''}`}>
        <form
          className="wizard-shell"
          onSubmit={(event) => {
            event.preventDefault();
            if (step < STEPS.length - 1) {
              if (stepReady[step]) setStep((current) => Math.min(STEPS.length - 1, current + 1));
              return;
            }
            submit();
          }}
        >
          <WizardProgress
            steps={STEPS}
            currentIndex={step}
            onStepSelect={setStep}
            isStepDisabled={(index) => index > step && !stepReady.slice(0, index).every(Boolean)}
          />

          {step === 0 && <PasoInicio state={state} setState={setState} clients={clients} conRespuestas={conRespuestas} isEdit={Boolean(editId)} />}
          {step === 1 && <PasoPreguntas state={state} setState={setState} questions={state.questions} conRespuestas={conRespuestas} idsGuardados={idsGuardados} onChange={(questions) => setState((current) => ({ ...current, questions }))} />}
          {step === 2 && <PasoDiseno state={state} setState={setState} />}
          {step === 3 && (
            <DistributionSelector
              selected={state.distribution}
              recipients={state.recipients}
              onToggleChannel={(channel) => setState((current) => ({
                ...current,
                distribution: current.distribution.includes(channel) ? current.distribution.filter((value) => value !== channel) : [...current.distribution, channel],
              }))}
              onRecipientsChange={(recipients) => setState((current) => ({ ...current, recipients }))}
              ga4={state.ga4MeasurementId}
              onGa4Change={(ga4MeasurementId) => setState((current) => ({ ...current, ga4MeasurementId }))}
            />
          )}
          {step === 4 && <ReviewAndSubmit state={state} isEdit={Boolean(editId)} cambiosPrevistos={cambiosPrevistos} errorDeEdicion={edicionPrevista?.error} />}

          {mutation.error && <div className="alert alert-error">{mutation.error.message}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => (step === 0 ? navigate('/surveys') : setStep((current) => current - 1))}>
              {step === 0 ? 'Cancelar' : 'Volver'}
            </button>
            <button className="btn btn-primary" disabled={mutation.isPending || !stepReady[step]}>
              {mutation.isPending ? 'Guardando...' : step < STEPS.length - 1 ? 'Continuar' : editId ? 'Guardar cambios' : 'Crear encuesta'}
            </button>
          </div>
        </form>
        {conVista && <VistaPrevia state={state} />}
      </div>
    </div>
  );
}
