import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type JSX } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { safeUrl } from '../../core/safe-url';
import { Ga4Tag } from '../../shared/Ga4Tag';
import { trackGa4Event } from '../../shared/ga4-events';
import type { Survey, SurveyQuestion, SurveyResponse } from '@espartanos/shared';
import { FlujoSimpleDeEncuesta } from './FlujoSimpleDeEncuesta';
import './surveys.css';

type Answers = Record<string, string | number>;

function answerIsEmpty(value: string | number | undefined): boolean {
  return value === undefined || value === '';
}

function numericAnswer(answers: Answers, questions: SurveyQuestion[]): number | null {
  const ratingQuestion = questions.find((question) => question.type === 'rating' || question.type === 'nps');
  const value = ratingQuestion ? Number(answers[ratingQuestion.id]) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

function sourceFromParams(searchParams: URLSearchParams): string {
  return searchParams.get('src') || searchParams.get('utm_source') || searchParams.get('source') || searchParams.get('via') || 'link';
}

function SurveyQuestionField({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
}) {
  if (question.type === 'text') {
    return (
      <label className="public-survey-field">
        <span>{question.question}{question.required ? ' *' : ''}</span>
        <textarea rows={4} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }

  if (question.type === 'multiple-choice') {
    return (
      <fieldset className="public-survey-field public-survey-options">
        <legend>{question.question}{question.required ? ' *' : ''}</legend>
        {(question.options ?? []).map((option) => (
          <label key={option}>
            <input type="radio" name={question.id} checked={value === option} onChange={() => onChange(option)} />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  const max = question.type === 'nps' ? 10 : 5;
  const min = question.type === 'nps' ? 0 : 1;
  return (
    <fieldset className="public-survey-field public-survey-scale">
      <legend>{question.question}{question.required ? ' *' : ''}</legend>
      <div>
        {Array.from({ length: max - min + 1 }, (_, index) => min + index).map((score) => (
          <button
            key={score}
            type="button"
            className={Number(value) === score ? 'active' : ''}
            onClick={() => onChange(score)}
          >
            {score}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function PublicSurveyPage(): JSX.Element {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [answers, setAnswers] = useState<Answers>({});
  const [submitted, setSubmitted] = useState(false);
  const source = useMemo(() => sourceFromParams(searchParams), [searchParams]);

  const { data: survey, isLoading, error } = useQuery<Survey>({
    queryKey: ['public-survey', id],
    queryFn: () => api.get(`/public/surveys/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
    retry: false,
  });

  const submitMutation = useMutation({
    /*
     * La encuesta va en la ruta y en ningún otro sitio.
     *
     * Mandarla también en el cuerpo la duplicaba, y el servidor rechaza los campos que no
     * declara. Aceptar ambos sería peor que rechazarlos: un cuerpo con otro id se convierte en
     * una forma de escribir respuestas en una encuesta ajena.
     */
    mutationFn: () => api.post<SurveyResponse, Partial<SurveyResponse>>(`/public/surveys/${encodeURIComponent(id)}/responses`, {
      respondentId: source,
      answers,
    }),
    onSuccess: () => {
      setSubmitted(true);
      trackGa4Event(survey?.ga4MeasurementId, 'survey_submitted', {
        survey_id: id,
        survey_title: survey?.title,
        source,
      });
    },
  });

  useEffect(() => {
    if (!survey?.ga4MeasurementId) return;
    trackGa4Event(survey.ga4MeasurementId, 'survey_viewed', {
      survey_id: survey.id,
      survey_title: survey.title,
      source,
    });
  }, [source, survey?.ga4MeasurementId, survey?.id, survey?.title]);

  const design = survey?.designConfig ?? {};
  const background = design.backgroundMode === 'gradient'
    ? design.backgroundGradient
    : design.backgroundMode === 'image' && design.backgroundImage
      ? `linear-gradient(rgba(255,255,255,${Number(design.backgroundOpacity ?? 88) / 100}), rgba(255,255,255,${Number(design.backgroundOpacity ?? 88) / 100})), url("${design.backgroundImage}") center/cover`
      : design.backgroundColor;
  const style = {
    '--survey-primary': design.primaryColor || '#0fb9b1',
    '--survey-accent': design.accentColor || '#ec0b61',
    '--survey-text': design.textColor || '#151317',
    '--survey-field-radius': `${Number(design.fieldRadius ?? 12)}px`,
    background: background || '#f6f4f5',
    color: design.textColor || '#151317',
    fontFamily: design.fontFamily || 'system-ui',
  } as CSSProperties;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!survey) return;
    submitMutation.mutate();
  };

  if (isLoading) return <main className="public-survey-page"><section className="public-survey-card"><p>Cargando encuesta...</p></section></main>;
  if (error || !survey) return <main className="public-survey-page"><section className="public-survey-card"><h1>Encuesta no disponible</h1><p>El enlace puede estar cerrado o mal escrito.</p></section></main>;

  /*
   * Con una pregunta de estrellas, la encuesta se responde por pasos: la nota primero y el resto
   * según cómo le fue. Sin ella no hay con qué decidir el camino y se responde completa, como antes.
   */
  const preguntaNota = survey.questions.find((question) => question.type === 'rating');
  if (preguntaNota) {
    return (
      <main className="public-survey-page" style={style}>
        <Ga4Tag measurementId={survey.ga4MeasurementId} />
        <section className="public-survey-card">
          {design.logoUrl ? <img className="public-survey-logo" src={design.logoUrl} alt="" /> : null}
          <span className="public-survey-eyebrow">Tu opinión</span>
          <h1>{survey.title}</h1>
          {design.welcome ? <p>{design.welcome}</p> : null}
          <FlujoSimpleDeEncuesta
            survey={survey}
            preguntaNota={preguntaNota}
            invitacion={searchParams.get('i')}
            origen={source}
            renderPregunta={(question, value, onChange) => <SurveyQuestionField question={question} value={value} onChange={onChange} />}
          />
        </section>
      </main>
    );
  }

  const missingRequired = survey.questions.some((question) => question.required && answerIsEmpty(answers[question.id]));
  const rating = numericAnswer(answers, survey.questions);
  const reviewMinRating = Number(survey.googleReview?.minRating ?? 4);
  const reviewUrl = safeUrl(survey.googleReview?.url || '');
  // La reseña se ofrece a todos: pedirla sólo a quien puso nota alta va contra la política de
  // Google Maps. A la nota baja se le muestra, pero después del mensaje y sin destacarla.
  const canShowReview = submitted && Boolean(reviewUrl);
  const notaAlta = rating === null || rating >= reviewMinRating;
  const successMessage = rating !== null && rating < reviewMinRating && survey.googleReview?.lowRatingMessage
    ? survey.googleReview.lowRatingMessage
    : 'Tu respuesta fue registrada correctamente.';

  if (submitted) {
    return (
      <main className="public-survey-page" style={style}>
        <Ga4Tag measurementId={survey.ga4MeasurementId} />
        <section className="public-survey-card public-survey-success">
          <span>✓</span>
          <h1>Gracias por responder</h1>
          <p>{successMessage}</p>
          {canShowReview ? <a className={notaAlta ? 'btn btn-primary' : 'flujo-encuesta-resena-discreta'} href={reviewUrl} target="_blank" rel="noopener noreferrer">{notaAlta ? 'Dejar reseña en Google' : 'Si igual quieres, también puedes opinar en Google'}</a> : null}
          <Link className="btn btn-outline" to={`/survey/${id}?src=${encodeURIComponent(source)}`}>Enviar otra respuesta</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="public-survey-page" style={style}>
      <Ga4Tag measurementId={survey.ga4MeasurementId} />
      <form className="public-survey-card" onSubmit={submit}>
        {design.logoUrl ? <img className="public-survey-logo" src={design.logoUrl} alt="" /> : null}
        <span className="public-survey-eyebrow">Encuesta</span>
        <h1>{survey.title}</h1>
        <p>{design.welcome || 'Tu opinión ayuda a mejorar el servicio.'}</p>

        <div className="public-survey-questions">
          {survey.questions.map((question) => (
            <SurveyQuestionField
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
            />
          ))}
        </div>

        {submitMutation.error ? <div className="alert alert-error">{submitMutation.error.message}</div> : null}
        <button className="btn btn-primary btn-block public-survey-submit" disabled={submitMutation.isPending || missingRequired}>
          {submitMutation.isPending ? 'Enviando...' : 'Enviar respuesta'}
        </button>
      </form>
    </main>
  );
}
