/**
 * @fileoverview Dashboard de resultados de una encuesta: una visualización por pregunta,
 * elegida según su `QuestionType`, más la exportación a CSV del resumen agregado.
 */

import { useMemo, useState, type JSX } from 'react';
import { useParams } from 'react-router-dom';
import { RespuestasPorPersona } from './RespuestasPorPersona';
import { nombreDeOrigen } from './CompartirEncuesta';
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';
import { PageHero } from '../../shared/PageHero';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import { useSurvey, useSurveyResults } from './useSurveys';
import { computeSurveyResults, DATOS_DE_CONTACTO } from '@espartanos/shared';
import type {
  Survey,
  SurveyIndividualResponse,
  ChoiceQuestionResult,
  NpsQuestionResult,
  RatingQuestionResult,
  SurveyQuestionResult,
  SurveyResultsSummary,
  TextQuestionResult,
} from '@espartanos/shared';
import './surveys.css';

const RATING_SCALE = ['1', '2', '3', '4', '5'];

function csvValue(value: unknown): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

/** Exporta el resumen agregado: una fila por pregunta con su métrica principal. */
function exportResultsCsv(surveyTitle: string, summary: SurveyResultsSummary): void {
  const rows = summary.questions.map((question) => [
    question.question,
    question.type,
    question.totalAnswers,
    question.type === 'nps' ? question.score ?? '' :
      question.type === 'rating' ? question.average ?? '' :
      question.type === 'multiple-choice' ? Object.entries(question.counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '' :
      question.answers.length,
  ]);
  const header = ['Pregunta', 'Tipo', 'Respuestas', 'Métrica principal'];
  const csv = [header, ...rows].map((row) => row.map(csvValue).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${surveyTitle || 'encuesta'}-resultados-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Respuestas por persona a CSV: una fila por respuesta y una columna por pregunta. */
function exportarRespuestasCsv(survey: Survey, respuestas: SurveyIndividualResponse[]): void {
  const preguntas = survey.questions;
  const header = ['Fecha', 'Nota', 'Nombre', 'Correo', 'Mensaje al equipo', 'Completó', 'Aceptó uso de datos', ...preguntas.map((q) => (q.dato ? DATOS_DE_CONTACTO[q.dato].etiqueta : q.question))];
  const filas = respuestas.map((r) => [
    new Date(r.submittedAt).toLocaleString('es-CL'), r.rating ?? '', r.respondentName ?? '', r.respondentEmail ?? '', r.teamMessage ?? '',
    r.completedAt ? 'Sí' : 'No', r.privacyConsentAt ? new Date(r.privacyConsentAt).toLocaleString('es-CL') : '',
    ...preguntas.map((q) => r.answers[q.id] ?? ''),
  ]);
  const csv = [header, ...filas].map((row) => row.map(csvValue).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${survey.title || 'encuesta'}-respuestas-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

type Periodo = '7' | '30' | '90' | 'todo';
const PERIODOS: Array<[Periodo, string]> = [['7', '7 días'], ['30', '30 días'], ['90', '90 días'], ['todo', 'Todo']];

/** Lunes de la semana de una fecha, para agrupar la tendencia. */
function inicioDeSemana(fecha: Date): Date {
  const dia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  dia.setDate(dia.getDate() - ((dia.getDay() + 6) % 7));
  return dia;
}

/** Respuestas y nota promedio de las últimas 8 semanas. */
function TendenciaSemanal({ respuestas }: { respuestas: SurveyIndividualResponse[] }) {
  const semanas = Array.from({ length: 8 }, (_, i) => {
    const inicio = inicioDeSemana(new Date());
    inicio.setDate(inicio.getDate() - (7 - i) * 7);
    return inicio;
  });
  const datos = semanas.map((inicio) => {
    const fin = new Date(inicio); fin.setDate(fin.getDate() + 7);
    const deLaSemana = respuestas.filter((r) => { const f = new Date(r.submittedAt); return f >= inicio && f < fin; });
    const notas = deLaSemana.map((r) => r.rating).filter((n): n is number => typeof n === 'number');
    return { inicio, total: deLaSemana.length, promedio: notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null };
  });
  const maximo = Math.max(1, ...datos.map((d) => d.total));
  return (
    <section className="results-tendencia" aria-label="Respuestas por semana">
      <header><h3>Últimas 8 semanas</h3><small>Barra: respuestas · arriba: nota promedio</small></header>
      <div className="results-tendencia-barras">
        {datos.map((d) => (
          <div key={d.inicio.toISOString()} className="results-tendencia-semana" title={`${d.total} respuestas${d.promedio !== null ? ` · promedio ${d.promedio}` : ''}`}>
            <span className="results-tendencia-promedio">{d.promedio ?? '—'}</span>
            <div className="results-tendencia-pista"><div style={{ height: `${(d.total / maximo) * 100}%` }} /></div>
            <span className="results-tendencia-total">{d.total}</span>
            <small>{d.inicio.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

/** De dónde llegaron las respuestas y cómo calificó cada canal. */
function PorOrigen({ respuestas }: { respuestas: SurveyIndividualResponse[] }) {
  const grupos = new Map<string, { total: number; notas: number[] }>();
  for (const r of respuestas) {
    const clave = r.origen || '';
    const grupo = grupos.get(clave) ?? { total: 0, notas: [] };
    grupo.total += 1;
    if (typeof r.rating === 'number') grupo.notas.push(r.rating);
    grupos.set(clave, grupo);
  }
  const filas = [...grupos.entries()].sort((a, b) => b[1].total - a[1].total);
  const maximo = Math.max(1, ...filas.map(([, g]) => g.total));
  return (
    <section className="results-origen" aria-label="Respuestas por canal">
      <header><h3>De dónde llegaron</h3><small>Según el enlace o QR usado</small></header>
      {filas.length === 0 ? <p className="page-subtitle">Sin respuestas en este período.</p> : (
        <ul>
          {filas.map(([origen, g]) => (
            <li key={origen}>
              <span>{nombreDeOrigen(origen)}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(g.total / maximo) * 100}%`, background: 'var(--cyan, #0fb9b1)' }} /></div>
              <b>{g.total}</b>
              <small>{g.notas.length ? `${(g.notas.reduce((a, b) => a + b, 0) / g.notas.length).toFixed(1)}★` : '—'}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Medidor semicircular del puntaje NPS, con el desglose de promotores/pasivos/detractores. */
function NpsGauge({ result }: { result: NpsQuestionResult & { totalAnswers: number } }) {
  const score = result.score ?? 0;
  const normalized = Math.max(0, Math.min(100, (score + 100) / 2));
  const color = score >= 50 ? '#087e79' : score >= 0 ? '#c67912' : '#b5332d';
  const breakdown: Array<{ label: string; value: number; color: string }> = [
    { label: 'Promotores (9-10)', value: result.promoters, color: '#087e79' },
    { label: 'Pasivos (7-8)', value: result.passives, color: '#c67912' },
    { label: 'Detractores (0-6)', value: result.detractors, color: '#b5332d' },
  ];
  return (
    <div className="results-nps">
      <div className="nps-gauge">
        <ResponsiveContainer width="100%" height={130}>
          <RadialBarChart cx="50%" cy="95%" innerRadius="72%" outerRadius="100%" barSize={16} startAngle={180} endAngle={0} data={[{ value: normalized }]}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
            <RadialBar dataKey="value" cornerRadius={8} fill={color} background={{ fill: '#eee8ec' }} isAnimationActive={false} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="nps-gauge-value"><strong>{result.score ?? '—'}</strong><span>NPS</span></div>
      </div>
      <div className="bar-chart">
        {breakdown.map((item) => {
          const share = result.totalAnswers > 0 ? Math.round((item.value / result.totalAnswers) * 100) : 0;
          return (
            <div className="bar-row" key={item.label}>
              <span className="bar-label">{item.label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${share}%`, background: item.color }} />
                <span className="bar-value">{item.value}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Barras de distribución 1-5 más el promedio, para preguntas `rating`. */
function RatingChart({ result }: { result: RatingQuestionResult & { totalAnswers: number } }) {
  return (
    <div className="results-rating">
      <div className="rating-average"><strong>{result.average ?? '—'}</strong><span>promedio / 5</span></div>
      <div className="bar-chart">
        {RATING_SCALE.map((value) => {
          const count = result.distribution[value] ?? 0;
          const share = result.totalAnswers > 0 ? Math.round((count / result.totalAnswers) * 100) : 0;
          return (
            <div className="bar-row" key={value}>
              <span className="bar-label">{value} ★</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${share}%`, background: '#0fb9b1' }} />
                <span className="bar-value">{count}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Tabla de conteos por opción, para preguntas `multiple-choice`. */
function ChoiceTable({ result }: { result: ChoiceQuestionResult & { totalAnswers: number } }) {
  const rows = Object.entries(result.counts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead><tr><th>Opción</th><th>Respuestas</th><th>Porcentaje</th></tr></thead>
        <tbody>
          {rows.map(([option, count]) => (
            <tr key={option}>
              <td data-label="Opción">{option}</td>
              <td data-label="Respuestas">{count}</td>
              <td data-label="Porcentaje">{result.totalAnswers > 0 ? Math.round((count / result.totalAnswers) * 100) : 0}%</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={3}>Sin respuestas todavía.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/** Nube de palabras a partir de las respuestas de texto libre, más el listado crudo. */
function TextWordCloud({ result }: { result: TextQuestionResult }) {
  const stopWords = new Set(['de', 'la', 'el', 'los', 'las', 'que', 'y', 'a', 'en', 'un', 'una', 'muy', 'con', 'es', 'lo', 'se', 'no', 'me', 'mi', 'su', 'por', 'para']);
  const frequencies = new Map<string, number>();
  for (const answer of result.answers) {
    for (const word of answer.toLocaleLowerCase('es').split(/[^a-záéíóúñ]+/i)) {
      if (word.length < 3 || stopWords.has(word)) continue;
      frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
    }
  }
  const words = Array.from(frequencies.entries()).sort((a, b) => b[1] - a[1]).slice(0, 30);
  const maxCount = words[0]?.[1] ?? 1;

  return (
    <div className="results-text">
      {words.length > 0 ? (
        <div className="word-cloud" aria-hidden="true">
          {words.map(([word, count]) => (
            <span key={word} style={{ fontSize: `${12 + (count / maxCount) * 20}px`, opacity: 0.55 + (count / maxCount) * 0.45 }}>{word}</span>
          ))}
        </div>
      ) : (
        <p className="page-subtitle">No hay suficiente texto para armar una nube de palabras.</p>
      )}
      <ul className="text-answer-list">
        {result.answers.slice(0, 20).map((answer, index) => <li key={index}>&ldquo;{answer}&rdquo;</li>)}
        {result.answers.length === 0 && <li className="page-subtitle">Sin respuestas todavía.</li>}
      </ul>
    </div>
  );
}

function QuestionResultCard({ result }: { result: SurveyQuestionResult }) {
  return (
    <article className="results-question-card">
      <header>
        <h3>{result.question}</h3>
        <span className="results-question-meta">{result.totalAnswers} respuesta{result.totalAnswers === 1 ? '' : 's'}{result.required ? ' · Obligatoria' : ''}</span>
      </header>
      {result.type === 'nps' && <NpsGauge result={result} />}
      {result.type === 'rating' && <RatingChart result={result} />}
      {result.type === 'multiple-choice' && <ChoiceTable result={result} />}
      {result.type === 'text' && <TextWordCloud result={result} />}
    </article>
  );
}

export function SurveyResultsPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { data: survey, isLoading: loadingSurvey, error: surveyError } = useSurvey(id);
  const { data: summary, isLoading: loadingResults, error: resultsError, refetch, isFetching } = useSurveyResults(survey);
  const [periodo, setPeriodo] = useState<Periodo>('todo');

  // Con el detalle por persona, todo se recalcula para el período con la misma función que usa el servidor.
  const filtradas = useMemo(() => {
    const todas = summary?.respuestas ?? [];
    if (periodo === 'todo') return todas;
    const desde = Date.now() - Number(periodo) * 86400000;
    return todas.filter((r) => new Date(r.submittedAt).getTime() >= desde);
  }, [summary?.respuestas, periodo]);
  const resumen = useMemo(() => {
    if (!survey || !summary?.respuestas) return summary;
    return { ...summary, ...computeSurveyResults(survey, filtradas.map((r) => ({ surveyId: survey.id, respondentId: r.id, answers: r.answers, submittedAt: r.submittedAt }))), completionRate: summary.completionRate, respuestas: filtradas };
  }, [survey, summary, filtradas]);

  if (loadingSurvey || (survey && loadingResults)) return <LoadingSpinner text="Cargando resultados..." />;
  if (surveyError) return <QueryErrorState title="No pudimos cargar la encuesta" message={surveyError.message} />;
  if (!survey) return <EmptyState icon="survey" title="Encuesta no encontrada" description="Puede haber sido eliminada." />;
  if (resultsError) {
    return <QueryErrorState title="No pudimos cargar los resultados" message={resultsError.message} onRetry={() => void refetch()} retrying={isFetching} />;
  }
  if (!summary || !resumen) return <EmptyState icon="chart" title="Sin resultados todavía" description="Los resultados aparecerán en cuanto lleguen respuestas." />;

  const notas = filtradas.map((r) => r.rating).filter((n): n is number => typeof n === 'number');
  const promedio = notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null;
  const nps = resumen.questions.find((q) => q.type === 'nps');
  const conMensaje = filtradas.filter((r) => r.teamMessage).length;
  const completaron = filtradas.length ? Math.round((filtradas.filter((r) => r.completedAt).length / filtradas.length) * 100) : null;
  const hayDetalle = Boolean(summary.respuestas);

  return (
    <div className="page survey-module">
      <PageHero
        eyebrow="RESULTADOS"
        title={survey.title}
        subtitle={`${summary.totalResponses} respuesta${summary.totalResponses === 1 ? '' : 's'}${summary.completionRate !== null ? ` · ${summary.completionRate}% de finalización` : ''}`}
        actions={<div className="results-acciones">
          {hayDetalle && <button type="button" className="btn btn-primary" disabled={!filtradas.length} onClick={() => exportarRespuestasCsv(survey, filtradas)}>Exportar respuestas</button>}
          <button type="button" className="btn btn-outline" onClick={() => exportResultsCsv(survey.title, resumen)}>Exportar resumen</button>
        </div>}
      />

      {summary.totalResponses > 0 && hayDetalle && (
        <div className="results-periodo" role="group" aria-label="Período">
          {PERIODOS.map(([valor, etiqueta]) => (
            <button key={valor} type="button" aria-pressed={periodo === valor} className={periodo === valor ? 'active' : ''} onClick={() => setPeriodo(valor)}>{etiqueta}</button>
          ))}
        </div>
      )}

      {summary.totalResponses > 0 && <div className="results-kpis">
        <div><span>Respuestas</span><b>{resumen.totalResponses}</b></div>
        {promedio !== null && <div className={promedio < 3.5 ? 'alerta' : ''}><span>Nota promedio</span><b>{promedio}<small>/5</small></b></div>}
        {nps?.type === 'nps' && <div><span>NPS</span><b>{nps.score ?? '—'}</b></div>}
        {hayDetalle && <div className={conMensaje ? 'alerta' : ''}><span>Mensajes al equipo</span><b>{conMensaje}</b></div>}
        {completaron !== null && <div><span>Completaron todo</span><b>{completaron}%</b></div>}
        {summary.completionRate !== null && <div><span>Tasa de respuesta</span><b>{summary.completionRate}%</b></div>}
      </div>}

      {summary.totalResponses > 0 && hayDetalle && <div className="results-medicion">
        <TendenciaSemanal respuestas={summary.respuestas ?? []} />
        <PorOrigen respuestas={filtradas} />
      </div>}

      {resumen.totalResponses === 0 ? (
        <EmptyState icon="chart" title={summary.totalResponses === 0 ? 'Todavía no hay respuestas' : 'Sin respuestas en este período'} description={summary.totalResponses === 0 ? 'Cuando alguien responda, los resultados de cada pregunta aparecerán aquí.' : 'Elige un período más largo.'} />
      ) : (
        <div className="results-grid">
          {resumen.questions.map((result) => <QuestionResultCard key={result.questionId} result={result} />)}
        </div>
      )}

      {/* Presente cuando el servidor lo entrega; la copia local sin red no tiene quién respondió. */}
      {filtradas.length > 0 && (
        <RespuestasPorPersona respuestas={filtradas} preguntas={survey.questions} />
      )}
    </div>
  );
}
