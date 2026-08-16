/**
 * @fileoverview Asistente de 5 pasos para crear o editar una encuesta.
 *
 * Reutiliza la misma pantalla para crear y editar: con `?id=<surveyId>` en la URL, precarga
 * la encuesta existente y guarda con `PUT` en vez de `POST`. Esto evita una quinta ruta que el
 * manifiesto de la feature no declara (`/surveys/create` es la única ruta de edición).
 */

import { useEffect, useState, type JSX } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WizardProgress, type WizardStepDescriptor } from '../../shared/WizardProgress';
import { PageHero } from '../../shared/PageHero';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { useAuth } from '../../core/auth';
import { triggerToast } from '../../shared/toast-events';
import { useCreateSurvey, useSurvey, useUpdateSurvey } from './useSurveys';
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
  questions: SurveyQuestion[];
  distribution: SurveyDistributionChannel[];
  recipients: string;
  primaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  logoUrl: string;
  welcome: string;
  googleReviewUrl: string;
  googleReviewMinRating: number;
  googleReviewLowMsg: string;
}

function blankState(): WizardState {
  return { title: '', type: 'customer', questions: [blankQuestion()], distribution: [], recipients: '', primaryColor: '#0fb9b1', backgroundColor: '#f6f4f5', fontFamily: 'system-ui', logoUrl: '', welcome: '', googleReviewUrl: '', googleReviewMinRating: 4, googleReviewLowMsg: '' };
}

function stateFromSurvey(survey: Survey): WizardState {
  return {
    title: survey.title,
    type: survey.type,
    questions: survey.questions.length ? survey.questions : [blankQuestion()],
    distribution: survey.distribution ?? [],
    recipients: (survey.recipients ?? []).join(', '),
    primaryColor: survey.designConfig?.primaryColor ?? '#0fb9b1',
    backgroundColor: survey.designConfig?.backgroundColor ?? '#f6f4f5',
    fontFamily: survey.designConfig?.fontFamily ?? 'system-ui',
    logoUrl: survey.designConfig?.logoUrl ?? '',
    welcome: survey.designConfig?.welcome ?? '',
    googleReviewUrl: survey.googleReview?.url ?? '',
    googleReviewMinRating: survey.googleReview?.minRating ?? 4,
    googleReviewLowMsg: survey.googleReview?.lowRatingMessage ?? '',
  };
}

/** Paso 1: a quién se dirige la encuesta. */
function SurveyTypesSelector({ value, onChange }: { value: SurveyType; onChange: (type: SurveyType) => void }) {
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
          <span>Encuesta a clientes finales de una empresa, p. ej. post-visita.</span>
        </button>
      </div>
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
  const currentUser = useAuth((auth) => auth.user);
  const { data: existingSurvey, isLoading } = useSurvey(editId);
  const createMutation = useCreateSurvey();
  const updateMutation = useUpdateSurvey();

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
    Boolean(state.title.trim()),
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
    const designConfig = { primaryColor: state.primaryColor, backgroundColor: state.backgroundColor, fontFamily: state.fontFamily, logoUrl: state.logoUrl || undefined, welcome: state.welcome || undefined };
    const googleReview = state.googleReviewUrl ? { url: state.googleReviewUrl, minRating: state.googleReviewMinRating, lowRatingMessage: state.googleReviewLowMsg || undefined } : undefined;

    if (editId) {
      updateMutation.mutate(
        { id: editId, patch: { title: state.title.trim(), type: state.type, questions, distribution, recipients: recipients.length ? recipients : undefined, designConfig, googleReview } },
        { onSuccess: () => { triggerToast('Encuesta actualizada'); navigate('/surveys'); } },
      );
      return;
    }
    createMutation.mutate(
      {
        title: state.title.trim(),
        type: state.type,
        questions,
        distribution,
        recipients: recipients.length ? recipients : undefined,
        designConfig,
        googleReview,
        createdBy: currentUser?.name ?? currentUser?.email ?? 'Desconocido',
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

        {step === 0 && <SurveyTypesSelector value={state.type} onChange={(type) => setState((current) => ({ ...current, type }))} />}
        {step === 0 && (
          <label>Nombre de la encuesta
            <input className="input" required value={state.title} onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))} placeholder="Ej. Satisfacción post-visita terraza" />
          </label>
        )}
        {step === 1 && <QuestionsEditor questions={state.questions} onChange={(questions) => setState((current) => ({ ...current, questions }))} />}
        {step === 2 && <div className="wizard-step-body">
          <p className="page-subtitle">Personaliza la apariencia de la página de respuesta. Colores, logo y mensaje de bienvenida.</p>
          <div className="design-mini-grid">
            <label>Color principal<input type="color" value={state.primaryColor} onChange={e => setState(c => ({...c, primaryColor: e.target.value}))} /></label>
            <label>Fondo<input type="color" value={state.backgroundColor} onChange={e => setState(c => ({...c, backgroundColor: e.target.value}))} /></label>
          </div>
          <label>Tipo de letra<select className="input" value={state.fontFamily} onChange={e => setState(c => ({...c, fontFamily: e.target.value}))}><option value="system-ui">Sistema</option><option value="Inter, sans-serif">Inter</option><option value="Georgia, serif">Georgia</option></select></label>
          <label>URL del logo<input className="input" value={state.logoUrl} onChange={e => setState(c => ({...c, logoUrl: e.target.value}))} placeholder="https://..." /></label>
          <label>Mensaje de bienvenida<textarea className="input" rows={3} value={state.welcome} onChange={e => setState(c => ({...c, welcome: e.target.value}))} placeholder="¡Queremos saber tu opinión!" /></label>
          <div className="permission-help"><strong>Google Reviews</strong><p>Al finalizar la encuesta, según la calificación, se redirige a Google. Si la calificación es baja, primero se pregunta si quiere contacto.</p></div>
          <label>URL de Google Reviews<input className="input" value={state.googleReviewUrl} onChange={e => setState(c => ({...c, googleReviewUrl: e.target.value}))} placeholder="https://g.page/r/..." /></label>
          <div className="form-row"><label>Estrellas mínimas para redirigir directo<input className="input" type="number" min={1} max={5} value={state.googleReviewMinRating} onChange={e => setState(c => ({...c, googleReviewMinRating: Number(e.target.value)}))} /><small style={{color:'var(--muted)'}}>Si califica con menos, se le pregunta si quiere contacto antes de ir a Google.</small></label></div>
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
