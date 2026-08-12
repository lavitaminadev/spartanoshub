/**
 * @fileoverview Dashboard de resultados de una encuesta: una visualización por pregunta,
 * elegida según su `QuestionType`, más la exportación a CSV del resumen agregado.
 */

import { type JSX } from 'react';
import { useParams } from 'react-router-dom';
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';
import { PageHero } from '../../shared/PageHero';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import { useSurvey, useSurveyResults } from './useSurveys';
import type {
  ChoiceQuestionResult,
  NpsQuestionResult,
  RatingQuestionResult,
  SurveyQuestionResult,
  SurveyResultsSummary,
  TextQuestionResult,
} from './types';
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

/** Medidor semicircular del puntaje NPS, con el desglose de promotores/pasivos/detractores. */
function NpsGauge({ result }: { result: NpsQuestionResult & { totalAnswers: number } }) {
  const score = result.score ?? 0;
  const normalized = Math.max(0, Math.min(100, (score + 100) / 2));
  const color = score >= 50 ? '#1f7a46' : score >= 0 ? '#c67912' : '#b5332d';
  const breakdown: Array<{ label: string; value: number; color: string }> = [
    { label: 'Promotores (9-10)', value: result.promoters, color: '#1f7a46' },
    { label: 'Pasivos (7-8)', value: result.passives, color: '#c67912' },
    { label: 'Detractores (0-6)', value: result.detractors, color: '#b5332d' },
  ];
  return (
    <div className="results-nps">
      <div className="nps-gauge">
        <ResponsiveContainer width="100%" height={130}>
          <RadialBarChart cx="50%" cy="95%" innerRadius="72%" outerRadius="100%" barSize={16} startAngle={180} endAngle={0} data={[{ value: normalized }]}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
            <RadialBar dataKey="value" cornerRadius={8} fill={color} background={{ fill: '#eef2ef' }} isAnimationActive={false} />
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

  if (loadingSurvey || (survey && loadingResults)) return <LoadingSpinner text="Cargando resultados..." />;
  if (surveyError) return <QueryErrorState title="No pudimos cargar la encuesta" message={surveyError.message} />;
  if (!survey) return <EmptyState icon="📋" title="Encuesta no encontrada" description="Puede haber sido eliminada." />;
  if (resultsError) {
    return <QueryErrorState title="No pudimos cargar los resultados" message={resultsError.message} onRetry={() => void refetch()} retrying={isFetching} />;
  }
  if (!summary) return <EmptyState icon="📊" title="Sin resultados todavía" description="Los resultados aparecerán en cuanto lleguen respuestas." />;

  return (
    <div className="page survey-module">
      <PageHero
        eyebrow="RESULTADOS"
        title={survey.title}
        subtitle={`${summary.totalResponses} respuesta${summary.totalResponses === 1 ? '' : 's'}${summary.completionRate !== null ? ` · ${summary.completionRate}% de finalización` : ''}`}
        actions={<button type="button" className="btn btn-outline" onClick={() => exportResultsCsv(survey.title, summary)}>Exportar CSV</button>}
      />
      {summary.totalResponses > 0 && <div className="intake-summary" style={{marginBottom:20}}>
        <div><span>Total respuestas</span><b>{summary.totalResponses}</b></div>
        <div><span>Finalización</span><b>{summary.completionRate ?? '—'}%</b></div>
        <div><span>Preguntas</span><b>{summary.questions.length}</b></div>
        <div><span>NPS promedio</span><b>{(() => { const nps = summary.questions.find(q => q.type === 'nps'); return nps?.type === 'nps' ? nps.score ?? '—' : '—'; })()}</b></div>
      </div>}

      {summary.totalResponses === 0 ? (
        <EmptyState icon="📊" title="Todavía no hay respuestas" description="Cuando alguien responda, los resultados de cada pregunta aparecerán aquí." />
      ) : (
        <div className="results-grid">
          {summary.questions.map((result) => <QuestionResultCard key={result.questionId} result={result} />)}
        </div>
      )}
    </div>
  );
}
