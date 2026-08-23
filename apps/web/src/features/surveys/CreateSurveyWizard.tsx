/**
 * @fileoverview Asistente de 5 pasos para crear o editar una encuesta.
 *
 * Reutiliza la misma pantalla para crear y editar: con `?id=<surveyId>` en la URL, precarga
 * la encuesta existente y guarda con `PUT` en vez de `POST`. Esto evita una quinta ruta que el
 * manifiesto de la feature no declara (`/surveys/create` es la única ruta de edición).
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
import type { QuestionType, Survey, SurveyDistributionChannel, SurveyQuestion, SurveyType } from '@espartanos/shared';
import './surveys.css';

const STEPS: WizardStepDescriptor[] = [
  { id: 'type', label: 'Tipo' },
  { id: 'questions', label: 'Preguntas' },
  { id: 'design', label: 'Diseño' },
  { id: 'distribution', label: 'Distribución' },
  { id: 'review', label: 'Revisión' },
];

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  nps: 'NPS (0-10)',
  rating: 'Calificación (1-5)',
  text: 'Texto libre',
  'multiple-choice': 'Opción múltiple',
};

const DISTRIBUTION_LABELS: Record<SurveyDistributionChannel, { label: string; description: string }> = {
  email: { label: 'Correo', description: 'Envía el enlace a una lista de destinatarios.' },
  qr: { label: 'Código QR', description: 'Para imprimir o mostrar en el local, sin destinatarios previos.' },
  link: { label: 'Enlace directo', description: 'Comparte una URL abierta por cualquier canal propio.' },
};

function blankQuestion(): SurveyQuestion {
  return { id: crypto.randomUUID(), type: 'rating', question: '', required: true };
}

interface WizardState {
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
  backgroundGradient: string;
  backgroundImage: string;
  backgroundOpacity: string;
  textColor: string;
  fontFamily: string;
  logoUrl: string;
  welcome: string;
  ga4MeasurementId: string;
  googleReviewUrl: string;
  googleReviewMinRating: number;
  googleReviewLowMsg: string;
}

function blankState(): WizardState {
  return {
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
    backgroundGradient: 'linear-gradient(135deg, #f6f4f5 0%, #e7f8f6 100%)',
    backgroundImage: '',
    backgroundOpacity: '88',
    textColor: '#151317',
    fontFamily: 'system-ui',
    logoUrl: '',
    welcome: '',
    ga4MeasurementId: '',
    googleReviewUrl: '',
    googleReviewMinRating: 4,
    googleReviewLowMsg: '',
  };
}

function stateFromSurvey(survey: Survey): WizardState {
  return {
    title: survey.title,
    type: survey.type,
    clientId: survey.clientId ?? '',
    questions: survey.questions.length ? survey.questions : [blankQuestion()],
    distribution: survey.distribution ?? [],
    recipients: (survey.recipients ?? []).join(', '),
    primaryColor: survey.designConfig?.primaryColor ?? '#0fb9b1',
    accentColor: survey.designConfig?.accentColor ?? '#ec0b61',
    backgroundColor: survey.designConfig?.backgroundColor ?? '#f6f4f5',
    backgroundMode: survey.designConfig?.backgroundMode ?? (survey.designConfig?.backgroundImage ? 'image' : 'color'),
    backgroundGradient: survey.designConfig?.backgroundGradient ?? 'linear-gradient(135deg, #f6f4f5 0%, #e7f8f6 100%)',
    backgroundImage: survey.designConfig?.backgroundImage ?? '',
    backgroundOpacity: survey.designConfig?.backgroundOpacity ?? '88',
    textColor: survey.designConfig?.textColor ?? '#151317',
    fontFamily: survey.designConfig?.fontFamily ?? 'system-ui',
    logoUrl: survey.designConfig?.logoUrl ?? '',
    welcome: survey.designConfig?.welcome ?? '',
    ga4MeasurementId: survey.ga4MeasurementId ?? '',
    googleReviewUrl: survey.googleReview?.url ?? '',
    googleReviewMinRating: survey.googleReview?.minRating ?? 4,
    googleReviewLowMsg: survey.googleReview?.lowRatingMessage ?? '',
  };
}

/** Paso 1: a quién se dirige la encuesta. */
function SurveyTypesSelector({ value, clientId, clients, onChange, onClientChange }: {
  value: SurveyType; clientId: string; clients: Array<{ id: string; name: string }>;
  onChange: (type: SurveyType) => void; onClientChange: (clientId: string) => void;
}) {
  return (
    <div className="wizard-step-body">
      <p className="page-subtitle">Elige el público: cambia el copy que verá quien responde y quién puede recibirla.</p>
      <div className="survey-type-options" role="radiogroup" aria-label="Tipo de encuesta">
        <button type="button" role="radio" aria-checked={value === 'internal'} className={value === 'internal' ? 'active' : ''} onClick={() => onChange('internal')}>
          <strong>Equipo</strong>
          <span>Encuesta interna, para las personas de Espartanos.</span>
        </button>
        <button type="button" role="radio" aria-checked={value === 'customer'} className={value === 'customer' ? 'active' : ''} onClick={() => onChange('customer')}>
          <strong>Clientes</strong>
          <span>Encuesta pública para clientes o asistentes, independiente de las reservas.</span>
        </button>
      </div>
      {value === 'customer' && <label>Empresa dueña de la encuesta
        <select className="input" value={clientId} onChange={(event) => onClientChange(event.target.value)} required>
          <option value="">Selecciona una empresa</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <small>La encuesta y sus resultados quedarán aislados para esta empresa.</small>
      </label>}
    </div>
  );
}

/** Paso 2: preguntas de la encuesta, con soporte para los 4 tipos declarados en `QuestionType`. */
function QuestionsEditor({ questions, onChange }: { questions: SurveyQuestion[]; onChange: (next: SurveyQuestion[]) => void }) {
  const update = (id: string, patch: Partial<SurveyQuestion>) =>
    onChange(questions.map((question) => (question.id === id ? { ...question, ...patch } : question)));
  const remove = (id: string) => onChange(questions.filter((question) => question.id !== id));

  return (
    <div className="wizard-step-body">
      <p className="page-subtitle">Agrega al menos una pregunta. El tipo NPS y Calificación se agregan solos al panel de resultados.</p>
      <div className="questions-editor">
        {questions.map((question, index) => (
          <article className="question-card" key={question.id}>
            <header>
              <span className="question-index">Pregunta {index + 1}</span>
              <button type="button" className="btn btn-outline btn-sm" disabled={questions.length <= 1} onClick={() => remove(question.id)}>Quitar</button>
            </header>
            <label>Enunciado
              <input
                className="input"
                required
                value={question.question}
                onChange={(event) => update(question.id, { question: event.target.value })}
                placeholder="Ej. ¿Qué tan probable es que nos recomiendes?"
              />
            </label>
            <div className="form-row">
              <label>Tipo de pregunta
                <select
                  className="input"
                  value={question.type}
                  onChange={(event) => {
                    const type = event.target.value as QuestionType;
                    update(question.id, { type, options: type === 'multiple-choice' ? question.options ?? ['', ''] : undefined });
                  }}
                >
                  {(Object.entries(QUESTION_TYPE_LABELS) as Array<[QuestionType, string]>).map(([type, label]) => (
                    <option key={type} value={type}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={question.required} onChange={(event) => update(question.id, { required: event.target.checked })} />
                Obligatoria
              </label>
            </div>
            {question.type === 'multiple-choice' && (
              <div className="choice-options-editor">
                <span>Opciones</span>
                {(question.options ?? []).map((option, optionIndex) => (
                  <div className="choice-option-row" key={optionIndex}>
                    <input
                      className="input"
                      required
                      value={option}
                      onChange={(event) => {
                        const options = [...(question.options ?? [])];
                        options[optionIndex] = event.target.value;
                        update(question.id, { options });
                      }}
                      placeholder={`Opción ${optionIndex + 1}`}
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={(question.options?.length ?? 0) <= 2}
                      onClick={() => update(question.id, { options: (question.options ?? []).filter((_, i) => i !== optionIndex) })}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => update(question.id, { options: [...(question.options ?? []), ''] })}>
                  + Agregar opción
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      <button type="button" className="btn btn-outline" onClick={() => onChange([...questions, blankQuestion()])}>+ Agregar pregunta</button>
    </div>
  );
}

/** Paso 4: canal de distribución y, si aplica, destinatarios explícitos. */
function DistributionSelector({
  selected,
  recipients,
  onToggleChannel,
  onRecipientsChange,
}: {
  selected: SurveyDistributionChannel[];
  recipients: string;
  onToggleChannel: (channel: SurveyDistributionChannel) => void;
  onRecipientsChange: (value: string) => void;
}) {
  const needsRecipients = selected.includes('email');
  return (
    <div className="wizard-step-body">
      <p className="page-subtitle">Define cómo se compartirá. Correo registra destinatarios; enlace y QR quedan como canales de publicación.</p>
      <div className="distribution-options">
        {(Object.entries(DISTRIBUTION_LABELS) as Array<[SurveyDistributionChannel, { label: string; description: string }]>).map(([channel, meta]) => (
          <label key={channel} className={`distribution-option ${selected.includes(channel) ? 'active' : ''}`}>
            <input type="checkbox" checked={selected.includes(channel)} onChange={() => onToggleChannel(channel)} />
            <div>
              <strong>{meta.label}</strong>
              <span>{meta.description}</span>
            </div>
          </label>
        ))}
      </div>
      {needsRecipients && (
        <label>Destinatarios (correos separados por coma)
          <textarea
            className="input"
            rows={3}
            value={recipients}
            onChange={(event) => onRecipientsChange(event.target.value)}
            placeholder="ana@cliente.cl, juan@cliente.cl"
          />
        </label>
      )}
    </div>
  );
}

/** Paso 5: resumen antes de guardar como borrador. */
function ReviewAndSubmit({ state, isEdit }: { state: WizardState; isEdit: boolean }) {
  const recipientCount = state.recipients.split(',').map((value) => value.trim()).filter(Boolean).length;
  return (
    <div className="wizard-step-body">
      <p className="page-subtitle">{isEdit ? 'Revisa los cambios antes de guardar.' : 'Revisa la encuesta antes de crearla como borrador.'}</p>
      <div className="review-summary">
        <div><span>Nombre</span><strong>{state.title || 'Sin nombre aún'}</strong></div>
        <div><span>Público</span><strong>{state.type === 'internal' ? 'Equipo' : 'Clientes'}</strong></div>
        <div><span>Preguntas</span><strong>{state.questions.length}</strong></div>
        <div><span>Medición</span><strong>{state.ga4MeasurementId ? 'GA4 configurado' : 'Sin GA4'}</strong></div>
        <div>
          <span>Distribución</span>
          <strong>{state.distribution.length ? state.distribution.map((channel) => DISTRIBUTION_LABELS[channel].label).join(', ') : 'Sin definir todavía'}</strong>
        </div>
        {state.distribution.includes('email') && <div><span>Destinatarios</span><strong>{recipientCount}</strong></div>}
      </div>
      <ul className="review-checklist">
        {state.questions.map((question, index) => (
          <li key={question.id}>
            <strong>{index + 1}. {question.question || 'Pregunta sin enunciado'}</strong>
            <span>{QUESTION_TYPE_LABELS[question.type]}{question.required ? ' · Obligatoria' : ''}</span>
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
  const { data: existingSurvey, isLoading } = useSurvey(editId);
  const createMutation = useCreateSurvey();
  const updateMutation = useUpdateSurvey();
  const { data: clientsResponse } = useQuery<{ data?: Array<{ id: string; name: string }> }>({
    queryKey: ['clients'], queryFn: () => api.get('/clients'),
  });
  const clients = clientsResponse?.data ?? [];

  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(blankState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (existingSurvey && !hydrated) {
      setState(stateFromSurvey(existingSurvey));
      setHydrated(true);
    }
  }, [existingSurvey, hydrated]);

  if (editId && isLoading) return <LoadingSpinner text="Cargando encuesta..." />;

  const stepReady: boolean[] = [
    Boolean(state.title.trim()) && (state.type !== 'customer' || Boolean(state.clientId)),
    state.questions.every((question) => question.question.trim() && (question.type !== 'multiple-choice' || (question.options ?? []).filter((option) => option.trim()).length >= 2)),
    true,
    true,
    true,
  ];

  const mutation = editId ? updateMutation : createMutation;
  const submit = () => {
    const questions = state.questions.map((question) => ({
      ...question,
      options: question.type === 'multiple-choice' ? (question.options ?? []).map((option) => option.trim()).filter(Boolean) : undefined,
    }));
    const recipients = state.recipients.split(',').map((value) => value.trim()).filter(Boolean);
    const distribution = state.distribution;
    const designConfig = {
      primaryColor: state.primaryColor,
      accentColor: state.accentColor,
      backgroundColor: state.backgroundColor,
      backgroundMode: state.backgroundMode,
      backgroundGradient: state.backgroundMode === 'gradient' ? state.backgroundGradient : undefined,
      backgroundImage: state.backgroundMode === 'image' ? state.backgroundImage || undefined : undefined,
      backgroundOpacity: state.backgroundOpacity,
      textColor: state.textColor,
      fontFamily: state.fontFamily,
      logoUrl: state.logoUrl || undefined,
      welcome: state.welcome || undefined,
    };
    const googleReview = state.googleReviewUrl ? { url: state.googleReviewUrl, minRating: state.googleReviewMinRating, lowRatingMessage: state.googleReviewLowMsg || undefined } : undefined;

    if (editId) {
      updateMutation.mutate(
        { id: editId, patch: { title: state.title.trim(), type: state.type, clientId: state.type === 'customer' ? state.clientId : undefined, questions, distribution, recipients: recipients.length ? recipients : undefined, ga4MeasurementId: state.ga4MeasurementId.trim() || null, designConfig, googleReview } },
        { onSuccess: () => { triggerToast('Encuesta actualizada'); navigate('/surveys'); } },
      );
      return;
    }
    createMutation.mutate(
      {
        title: state.title.trim(),
        type: state.type,
        clientId: state.type === 'customer' ? state.clientId : undefined,
        questions,
        distribution,
        recipients: recipients.length ? recipients : undefined,
        ga4MeasurementId: state.ga4MeasurementId.trim() || null,
        designConfig,
        googleReview,
      },
      { onSuccess: () => { triggerToast('Encuesta creada'); navigate('/surveys'); } },
    );
  };

  return (
    <div className="page survey-module">
      <PageHero
        eyebrow="MEDICIÓN"
        title={editId ? 'Editar encuesta' : 'Nueva encuesta'}
        subtitle="Define público, preguntas, diseño, distribución y revisión."
      />
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

        {step === 0 && <SurveyTypesSelector value={state.type} clientId={state.clientId} clients={clients} onChange={(type) => setState((current) => ({ ...current, type, clientId: type === 'internal' ? '' : current.clientId }))} onClientChange={(clientId) => setState((current) => ({ ...current, clientId }))} />}
        {step === 0 && (
          <label>Nombre de la encuesta
            <input className="input" required value={state.title} onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))} placeholder="Ej. Satisfacción clientes agosto" />
          </label>
        )}
        {step === 1 && <QuestionsEditor questions={state.questions} onChange={(questions) => setState((current) => ({ ...current, questions }))} />}
        {step === 2 && <div className="wizard-step-body">
          <p className="page-subtitle">Ajusta la página pública de respuesta sin mezclarla con Reservas.</p>
          <div className="survey-design-grid">
            <label>Color principal<input type="color" value={state.primaryColor} onChange={e => setState(c => ({...c, primaryColor: e.target.value}))} /></label>
            <label>Acento<input type="color" value={state.accentColor} onChange={e => setState(c => ({...c, accentColor: e.target.value}))} /></label>
            <label>Fondo<input type="color" value={state.backgroundColor} onChange={e => setState(c => ({...c, backgroundColor: e.target.value}))} /></label>
            <label>Texto<input type="color" value={state.textColor} onChange={e => setState(c => ({...c, textColor: e.target.value}))} /></label>
          </div>
          <div className="form-row">
            <label>Tipo de letra<select className="input" value={state.fontFamily} onChange={e => setState(c => ({...c, fontFamily: e.target.value}))}><option value="system-ui">Sistema</option><option value="Inter, sans-serif">Inter</option><option value="Georgia, serif">Georgia</option></select></label>
            <label>Tipo de fondo<select className="input" value={state.backgroundMode} onChange={e => setState(c => ({...c, backgroundMode: e.target.value}))}><option value="color">Color plano</option><option value="gradient">Degradado</option><option value="image">Imagen</option></select></label>
          </div>
          {state.backgroundMode === 'gradient' && <label>Degradado<input className="input" value={state.backgroundGradient} onChange={e => setState(c => ({...c, backgroundGradient: e.target.value}))} placeholder="linear-gradient(...)" /></label>}
          {state.backgroundMode === 'image' && <>
            <ImageUpload label="Imagen de fondo" value={state.backgroundImage} onChange={(url) => setState(c => ({...c, backgroundImage: url}))} placeholder="https://..." maxSizeMB={5} />
            <label>Claridad del fondo ({state.backgroundOpacity}%)<input type="range" min="0" max="100" value={state.backgroundOpacity} onChange={e => setState(c => ({...c, backgroundOpacity: e.target.value}))} /></label>
          </>}
          <ImageUpload label="Logo de la encuesta" value={state.logoUrl} onChange={(url) => setState(c => ({...c, logoUrl: url}))} placeholder="https://..." maxSizeMB={3} />
          <label>Mensaje de bienvenida<textarea className="input" rows={3} value={state.welcome} onChange={e => setState(c => ({...c, welcome: e.target.value}))} placeholder="Queremos saber tu opinión." /></label>
          <label>ID de medición Google Analytics 4<input className="input" value={state.ga4MeasurementId} onChange={e => setState(c => ({...c, ga4MeasurementId: e.target.value.trim()}))} placeholder="G-XXXXXXXXXX" /><small>Encuestas usa GA4 para medir respuestas; no activa Meta CAPI.</small></label>
          <details className="survey-optional-box">
            <summary>Google Reviews</summary>
            <label>URL de Google Reviews<input className="input" value={state.googleReviewUrl} onChange={e => setState(c => ({...c, googleReviewUrl: e.target.value}))} placeholder="https://g.page/r/..." /></label>
            <div className="form-row"><label>Estrellas mínimas para redirigir directo<input className="input" type="number" min={1} max={5} value={state.googleReviewMinRating} onChange={e => setState(c => ({...c, googleReviewMinRating: Number(e.target.value)}))} /></label></div>
            <label>Mensaje si la calificación es baja<textarea className="input" rows={2} value={state.googleReviewLowMsg} onChange={e => setState(c => ({...c, googleReviewLowMsg: e.target.value}))} placeholder="Gracias por avisarnos. Revisaremos tu caso." /></label>
          </details>
        </div>}
        {step === 3 && (
          <DistributionSelector
            selected={state.distribution}
            recipients={state.recipients}
            onToggleChannel={(channel) => setState((current) => ({
              ...current,
              distribution: current.distribution.includes(channel) ? current.distribution.filter((value) => value !== channel) : [...current.distribution, channel],
            }))}
            onRecipientsChange={(recipients) => setState((current) => ({ ...current, recipients }))}
          />
        )}
        {step === 4 && <ReviewAndSubmit state={state} isEdit={Boolean(editId)} />}

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
    </div>
  );
}
