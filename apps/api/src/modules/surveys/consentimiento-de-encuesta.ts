/**
 * @fileoverview La aceptación que se pide cuando una encuesta solicita datos personales.
 *
 * La empresa dueña de la encuesta es la responsable de esos datos y Espartanos los trata por su
 * encargo. El texto se arma aquí, en un solo lugar: la página muestra exactamente este texto y la
 * respuesta guarda exactamente el mismo, así que lo aceptado siempre se puede demostrar.
 */

import type { SurveyConsent, SurveyQuestion } from '@espartanos/shared';
import { BadRequestException } from '@nestjs/common';
import { OPERADOR_ESPARTANOS, PLAZOS_DE_CONSERVACION, faltantesDeIdentidadLegal, mensajeDeIdentidadIncompleta, nombreLegalDelLocal, nombreLegalDelOperador, pideDatosPersonales, pideDatosSensibles, traeDatosPersonales } from '@espartanos/shared';

interface ConsultaSql { query(sql: string, parametros?: unknown[]): Promise<unknown> }

export const VERSION_CONSENTIMIENTO_ENCUESTA = 'survey-v2';

/** Texto de la aceptación para una encuesta, o `null` si no pide datos personales. */
export async function consentimientoDeEncuesta(db: ConsultaSql, survey: { clientId?: string | null; questions?: SurveyQuestion[] | null }): Promise<SurveyConsent | null> {
  if (!pideDatosPersonales(survey.questions ?? [])) return null;
  let empresa: Record<string, string | null> | undefined;
  if (survey.clientId) {
    const filas = await db.query(
      'SELECT name, legal_name, tax_id, privacy_email, privacy_url, legal_mode, privacy_text FROM clients WHERE id = ? LIMIT 1',
      [survey.clientId],
    ).catch(() => []) as Array<Record<string, string | null>>;
    empresa = filas?.[0];
  }
  // Sin empresa, la encuesta es de Espartanos y Espartanos es el responsable.
  const responsable = empresa
    ? nombreLegalDelLocal({ razonSocial: empresa.legal_name, rut: empresa.tax_id, nombreComercial: empresa.name })
    : nombreLegalDelOperador();
  const correo = empresa?.privacy_email?.trim() || OPERADOR_ESPARTANOS.correo;
  const porEncargo = empresa ? ` La plataforma ${OPERADOR_ESPARTANOS.marca} los trata por encargo de ${responsable}.` : '';
  const sensibles = pideDatosSensibles(survey.questions ?? [])
    ? ` Autorizo expresamente el uso de la información de salud o alimentación que indique sólo para atender mi respuesta; no se usa para publicidad ni se comparte con terceros.`
    : '';
  const texto = `Acepto que ${responsable} use los datos que dejo en esta encuesta para conocer mi opinión y, si corresponde, contactarme sobre ella. Se conservan hasta ${PLAZOS_DE_CONSERVACION.encuestasMeses} meses y luego se anonimizan. Puedo ejercer mis derechos de acceso, rectificación, supresión, oposición, portabilidad y bloqueo escribiendo a ${correo}, y reclamar ante la Agencia de Protección de Datos Personales.${sensibles}${porEncargo}`;
  const modoTexto = empresa?.legal_mode === 'texto';
  return {
    texto,
    version: VERSION_CONSENTIMIENTO_ENCUESTA,
    responsable,
    identidad: empresa ? { razonSocial: empresa.legal_name, rut: empresa.tax_id, correo: empresa.privacy_email, nombreComercial: empresa.name } : null,
    privacyUrl: modoTexto ? null : empresa?.privacy_url || null,
    privacyText: modoTexto ? empresa?.privacy_text || null : null,
  };
}

/**
 * Exige la aceptación cuando lo contestado trae datos personales y devuelve lo que se guarda.
 *
 * @returns Los campos a guardar en la respuesta, vacío si no aplica.
 * @throws Error con el mensaje para la persona si faltó aceptar.
 */
export async function aceptacionAGuardar(
  db: ConsultaSql,
  survey: { clientId?: string | null; questions?: SurveyQuestion[] | null },
  respuestas: Record<string, string | number>,
  acepta: boolean | undefined,
): Promise<{ privacyConsentAt?: Date; privacyConsentText?: string }> {
  if (!traeDatosPersonales(survey.questions ?? [], respuestas)) return {};
  if (acepta !== true) throw new Error('Para enviar tus datos tienes que aceptar su uso');
  const consentimiento = await consentimientoDeEncuesta(db, survey);
  return consentimiento ? { privacyConsentAt: new Date(), privacyConsentText: `[${consentimiento.version}] ${consentimiento.texto}` } : {};
}

/** Nombre y correo escritos en la encuesta, para identificar la respuesta en resultados. */
export function contactoEscrito(questions: SurveyQuestion[], respuestas: Record<string, string | number>): { nombre?: string; correo?: string } {
  const valor = (dato: string) => {
    const pregunta = questions.find((item) => item.dato === dato);
    const escrito = pregunta ? respuestas[pregunta.id] : undefined;
    return typeof escrito === 'string' && escrito.trim() ? escrito.trim() : undefined;
  };
  return { nombre: valor('nombre')?.slice(0, 180), correo: valor('correo')?.slice(0, 190) };
}

/**
 * Impide activar una encuesta de una empresa que pide datos personales sin su identidad legal.
 *
 * Una encuesta sin empresa es de Espartanos, que ya está identificado; una sin datos personales no
 * necesita responsable ante quien responde.
 *
 * @throws BadRequestException con lo que falta completar.
 */
export async function exigirIdentidadLegalDeEncuesta(db: ConsultaSql, clientId: string | null | undefined, preguntas: SurveyQuestion[] | null | undefined): Promise<void> {
  if (!clientId || !pideDatosPersonales(preguntas ?? [])) return;
  const filas = await db.query('SELECT legal_name, tax_id, privacy_email FROM clients WHERE id = ? LIMIT 1', [clientId]) as Array<Record<string, string | null>>;
  const empresa = filas?.[0];
  const faltan = faltantesDeIdentidadLegal({ razonSocial: empresa?.legal_name, rut: empresa?.tax_id, correo: empresa?.privacy_email });
  if (faltan.length) throw new BadRequestException(mensajeDeIdentidadIncompleta(faltan));
}
