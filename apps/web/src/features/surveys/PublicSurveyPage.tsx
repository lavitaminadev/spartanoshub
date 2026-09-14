import { Fragment, useEffect, useMemo, useState, type FormEvent, type JSX } from 'react';
import { optimizedUrl } from '../../shared/imagen-optimizada';
import { origenDeEstaVisita } from '../../shared/origen-automatico';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { safeUrl } from '../../core/safe-url';
import { Ga4Tag } from '../../shared/Ga4Tag';
import { trackGa4Event } from '../../shared/ga4-events';
import type { Survey, SurveyQuestion, SurveyResponse } from '@espartanos/shared';
import { ordenarParaMostrar, preguntasVisibles, problemasDeRespuesta, traeDatosPersonales } from '@espartanos/shared';
import { AceptacionDeDatos, CampoDeEncuesta } from './CampoDeEncuesta';
import { estiloDeEncuesta } from './estilo-de-encuesta';
import { FlujoSimpleDeEncuesta } from './FlujoSimpleDeEncuesta';
import './surveys.css';

type Answers = Record<string, string | number>;

function numericAnswer(answers: Answers, questions: SurveyQuestion[]): number | null {
  const ratingQuestion = questions.find((question) => question.type === 'rating' || question.type === 'nps');
  const value = ratingQuestion ? Number(answers[ratingQuestion.id]) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

function sourceFromParams(searchParams: URLSearchParams): string {
  return searchParams.get('src') || searchParams.get('utm_source') || searchParams.get('source') || searchParams.get('via') || origenDeEstaVisita()?.source || 'link';
}

export function PublicSurveyPage(): JSX.Element {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [answers, setAnswers] = useState<Answers>({});
  const [submitted, setSubmitted] = useState(false);
  const [aceptada, setAceptada] = useState(false);
  const [intentoEnviar, setIntentoEnviar] = useState(false);
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
      // Sólo lo que la persona vio: una respuesta de una pregunta que después quedó oculta no se envía.
      answers: Object.fromEntries(Object.entries(answers).filter(([clave]) => preguntasVisibles(survey?.questions ?? [], answers).some((pregunta) => pregunta.id === clave))),
      ...(aceptada ? { aceptaPrivacidad: true } : {}),
    } as Partial<SurveyResponse>),
    onSuccess: () => {
      setSubmitted(true);
      trackGa4Event(survey?.ga4MeasurementId, 'survey_submitted', {
        survey_id: id,
        survey_title: survey?.title,
        source,
      });
    },
  });

  // Una visita por sesión del navegador, con su canal: permite comparar visitas con respuestas.
  useEffect(() => {
    if (!survey?.id || survey.status !== 'active') return;
    let sesion = '';
    try {
      const clave = `vh.encuesta.sesion.${survey.id}`;
      sesion = sessionStorage.getItem(clave) || '';
      if (!sesion) { sesion = crypto.randomUUID().replace(/-/g, ''); sessionStorage.setItem(clave, sesion); }
    } catch { sesion = crypto.randomUUID().replace(/-/g, ''); }
    void api.post(`/public/surveys/${encodeURIComponent(survey.id)}/visit`, { sesion, origen: source.slice(0, 60).replace(/[^A-Za-z0-9._-]/g, '-') }).catch(() => undefined);
  }, [survey?.id, survey?.status, source]);

  useEffect(() => {
    if (!survey?.ga4MeasurementId) return;
    trackGa4Event(survey.ga4MeasurementId, 'survey_viewed', {
      survey_id: survey.id,
      survey_title: survey.title,
      source,
    });
  }, [source, survey?.ga4MeasurementId, survey?.id, survey?.title]);

  const design = survey?.designConfig ?? {};
  const style = estiloDeEncuesta(design);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!survey) return;
    setIntentoEnviar(true);
    if (problemas.length > 0 || faltaAceptar) return;
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
          {design.logoUrl ? <img className="public-survey-logo" src={optimizedUrl(design.logoUrl, 480)} alt="" /> : null}
          <span className="public-survey-eyebrow">Tu opinión</span>
          <h1>{survey.title}</h1>
          {design.welcome ? <p>{design.welcome}</p> : null}
          <FlujoSimpleDeEncuesta
            survey={survey}
            preguntaNota={preguntaNota}
            invitacion={searchParams.get('i')}
            origen={source}
            renderPregunta={(question, value, onChange, mostrarError) => <CampoDeEncuesta question={question} value={value} onChange={onChange} mostrarError={mostrarError} />}
          />
        </section>
      </main>
    );
  }

  const visibles = ordenarParaMostrar(preguntasVisibles(survey.questions, answers));
  const problemas = problemasDeRespuesta(survey.questions, answers);
  const faltaAceptar = Boolean(survey.consentimiento) && traeDatosPersonales(survey.questions, answers) && !aceptada;
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
        {design.logoUrl ? <img className="public-survey-logo" src={optimizedUrl(design.logoUrl, 480)} alt="" /> : null}
        <span className="public-survey-eyebrow">Encuesta</span>
        <h1>{survey.title}</h1>
        <p>{design.welcome || 'Tu opinión ayuda a mejorar el servicio.'}</p>

        <div className="public-survey-questions">
          {visibles.some((question) => question.dato) ? <h2 className="public-survey-grupo">Tus datos</h2> : null}
          {visibles.map((question, indice) => (
            <Fragment key={question.id}>
            {question.dato ? null : !visibles[indice - 1] || visibles[indice - 1].dato ? (visibles.some((q) => q.dato) ? <h2 className="public-survey-grupo">Tu opinión</h2> : null) : null}
            <CampoDeEncuesta
              key={question.id}
              question={question}
              value={answers[question.id]}
              mostrarError={intentoEnviar}
              onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
            />
            </Fragment>
          ))}
        </div>

        {survey.consentimiento && traeDatosPersonales(survey.questions, answers) ? <AceptacionDeDatos consentimiento={survey.consentimiento} aceptada={aceptada} onChange={setAceptada} /> : null}
        {intentoEnviar && (problemas.length > 0 || faltaAceptar) ? <div className="alert alert-error" role="alert">{[...problemas, ...(faltaAceptar ? ['Acepta el uso de tus datos para enviar'] : [])].join(' · ')}</div> : null}
        {submitMutation.error ? <div className="alert alert-error">{submitMutation.error.message}</div> : null}
        <button className="btn btn-primary btn-block public-survey-submit" disabled={submitMutation.isPending}>
          {submitMutation.isPending ? 'Enviando...' : 'Enviar respuesta'}
        </button>
      </form>
    </main>
  );
}
