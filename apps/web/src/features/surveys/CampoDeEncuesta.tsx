/**
 * @fileoverview Un campo de la página pública de una encuesta y la aceptación de datos.
 *
 * Los usan la página real, el flujo por pasos y la vista previa del editor, para que las tres
 * muestren lo mismo.
 */

import { useState, type JSX } from 'react';
import { documentoATexto, faltantesDeIdentidadLegal, politicaDePrivacidadDelLocal, rutaDocumentoLegal } from '@espartanos/shared';
import type { SurveyConsent, SurveyQuestion } from '@espartanos/shared';
import { DATOS_DE_CONTACTO, errorDeDato, formatearRut } from '@espartanos/shared';
import { safeUrl } from '../../core/safe-url';

export function CampoDeEncuesta({
  question,
  value,
  onChange,
  mostrarError = false,
  estrellas = false,
}: {
  question: SurveyQuestion;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  /** Se muestra el error de formato recién cuando la persona sale del campo o intenta enviar. */
  mostrarError?: boolean;
  /** Muestra la nota de 1 a 5 como estrellas grandes, igual que el flujo por pasos. */
  estrellas?: boolean;
}): JSX.Element {
  const [tocado, setTocado] = useState(false);
  const obligatoria = question.required ? ' *' : '';

  if (question.dato) {
    const meta = DATOS_DE_CONTACTO[question.dato];
    const error = (tocado || mostrarError) ? errorDeDato(question.dato, value) : null;
    return (
      <label className={`public-survey-field public-survey-dato${error ? ' con-error' : ''}`}>
        <span>{question.question}{obligatoria}</span>
        <input
          type={meta.tipo}
          inputMode={question.dato === 'rut' ? 'text' : undefined}
          autoComplete={meta.autocompletar}
          placeholder={meta.tipo === 'date' ? undefined : meta.placeholder}
          max={meta.tipo === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
          min={meta.tipo === 'date' ? '1900-01-01' : undefined}
          value={String(value ?? '')}
          aria-invalid={Boolean(error)}
          onBlur={() => setTocado(true)}
          onChange={(event) => onChange(question.dato === 'rut' ? formatearRut(event.target.value) : event.target.value)}
        />
        {error ? <small role="alert">{error}</small> : null}
      </label>
    );
  }

  if (question.type === 'text') {
    return (
      <label className="public-survey-field">
        <span>{question.question}{obligatoria}</span>
        <textarea rows={4} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }

  if (question.type === 'multiple-choice') {
    return (
      <fieldset className="public-survey-field public-survey-options">
        <legend>{question.question}{obligatoria}</legend>
        {(question.options ?? []).map((option) => (
          <label key={option}>
            <input type="radio" name={question.id} checked={value === option} onChange={() => onChange(option)} />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  if (estrellas && question.type === 'rating') {
    return (
      <div className="public-survey-field flujo-encuesta-vista">
        <span>{question.question}{obligatoria}</span>
        <div className="flujo-estrellas" role="radiogroup" aria-label={question.question}>
          {[1, 2, 3, 4, 5].map((valor) => (
            <button key={valor} type="button" role="radio" aria-checked={Number(value) === valor} aria-label={`${valor} ${valor === 1 ? 'estrella' : 'estrellas'}`} className={Number(value) >= valor ? 'activa' : ''} onClick={() => onChange(valor)}>★</button>
          ))}
        </div>
      </div>
    );
  }

  const max = question.type === 'nps' ? 10 : 5;
  const min = question.type === 'nps' ? 0 : 1;
  return (
    <fieldset className={`public-survey-field public-survey-scale${question.type === 'nps' ? ' escala-nps' : ''}`}>
      <legend>{question.question}{obligatoria}</legend>
      <div>
        {Array.from({ length: max - min + 1 }, (_, index) => min + index).map((score) => (
          <button key={score} type="button" aria-pressed={Number(value) === score} className={Number(value) === score ? 'active' : ''} onClick={() => onChange(score)}>
            {score}
          </button>
        ))}
      </div>
      {question.type === 'nps' ? <p className="escala-nps-extremos"><span>Nada probable</span><span>Muy probable</span></p> : null}
    </fieldset>
  );
}

/** Casilla de aceptación con el texto exacto que guarda el servidor y el detalle de privacidad. */
export function AceptacionDeDatos({ consentimiento, aceptada, onChange }: { consentimiento: SurveyConsent; aceptada: boolean; onChange: (aceptada: boolean) => void }): JSX.Element {
  const [verTexto, setVerTexto] = useState(false);
  const enlace = consentimiento.privacyUrl ? safeUrl(consentimiento.privacyUrl) : '';
  // Sin política propia se muestra la generada con los datos reales del responsable; si la encuesta es de Espartanos, la de Espartanos.
  const identidad = consentimiento.identidad;
  const generada = !enlace && !consentimiento.privacyText && identidad && faltantesDeIdentidadLegal(identidad).length === 0 ? documentoATexto(politicaDePrivacidadDelLocal(identidad)) : '';
  const textoPolitica = consentimiento.privacyText || generada;
  return (
    <div className="public-survey-aceptacion">
      <label>
        <input type="checkbox" checked={aceptada} onChange={(event) => onChange(event.target.checked)} />
        <span>{consentimiento.texto}</span>
      </label>
      {enlace ? <a href={enlace} target="_blank" rel="noopener noreferrer">Ver política de privacidad</a> : null}
      {!enlace && textoPolitica ? (
        <>
          <button type="button" className="public-survey-enlace" aria-expanded={verTexto} onClick={() => setVerTexto(!verTexto)}>{verTexto ? 'Ocultar política de privacidad' : 'Ver política de privacidad'}</button>
          {verTexto ? <div className="public-survey-privacidad">{textoPolitica}</div> : null}
        </>
      ) : null}
      <a href={rutaDocumentoLegal('privacidad')} target="_blank" rel="noopener">{identidad ? 'Privacidad de Espartanos (plataforma)' : 'Política de privacidad de Espartanos'}</a>
    </div>
  );
}
