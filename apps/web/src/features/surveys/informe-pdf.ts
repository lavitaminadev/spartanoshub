import type { Survey, SurveyQuestionResult, SurveyResultsSummary } from '@espartanos/shared';

/**
 * @fileoverview El informe de resultados de una encuesta, para descargar en PDF y mandarlo.
 *
 * Usa la imprenta del navegador, igual que el resto de los PDF del sistema: una hoja maquetada en
 * una ventana aparte, sin librería de PDF. Sólo lleva resultados agregados y comentarios; los
 * datos de contacto y los mensajes privados al equipo no salen, para que se pueda reenviar.
 */

export interface DatosDelInforme {
  survey: Survey;
  resumen: SurveyResultsSummary;
  /** Período que muestra, tal como se lee en pantalla: «Últimos 30 días». */
  periodo: string;
  /** Nota promedio de la primera pregunta, en la escala de la encuesta. */
  promedio: number | null;
  /** Porcentaje de respuestas que llegaron al final. */
  completaron: number | null;
}

const TINTA = '#151317';
const GRIS = '#706a73';
const LINEA = '#e7e1e5';
const MAX_COMENTARIOS = 40;

const escapar = (valor: string) => valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Un color de la encuesta sólo si es un hexadecimal: va dentro de la hoja de estilos. */
const colorSeguro = (valor: unknown, porDefecto: string) => (typeof valor === 'string' && /^#[0-9a-f]{3,8}$/i.test(valor.trim()) ? valor.trim() : porDefecto);

/** Barra horizontal con su etiqueta, su conteo y su porcentaje. */
function barra(etiqueta: string, cantidad: number, total: number, acento: string): string {
  const porcentaje = total > 0 ? Math.round((cantidad / total) * 100) : 0;
  return `<div class="barra"><span class="barra-etiqueta">${escapar(etiqueta)}</span><span class="barra-pista"><span style="width:${porcentaje}%;background:${acento}"></span></span><span class="barra-valor">${cantidad} · ${porcentaje}%</span></div>`;
}

function bloqueDePregunta(pregunta: SurveyQuestionResult, acento: string): string {
  const titulo = `<h3>${escapar(pregunta.question)}</h3><p class="respondieron">${pregunta.totalAnswers} respuesta${pregunta.totalAnswers === 1 ? '' : 's'}</p>`;
  if (pregunta.type === 'rating') {
    const valores = Object.keys(pregunta.distribution).sort((a, b) => Number(b) - Number(a));
    const total = valores.reduce((suma, valor) => suma + (pregunta.distribution[valor] ?? 0), 0);
    return `<section class="pregunta">${titulo}<p class="destacado">Promedio <b>${pregunta.average === null ? '—' : pregunta.average.toFixed(1)}</b></p>${valores.map((valor) => barra(`${valor} ★`, pregunta.distribution[valor] ?? 0, total, acento)).join('')}</section>`;
  }
  if (pregunta.type === 'nps') {
    const total = pregunta.promoters + pregunta.passives + pregunta.detractors;
    return `<section class="pregunta">${titulo}<p class="destacado">NPS <b>${pregunta.score === null ? '—' : pregunta.score}</b></p>${barra('Promotores (9-10)', pregunta.promoters, total, '#0f9d58')}${barra('Pasivos (7-8)', pregunta.passives, total, '#b7791f')}${barra('Detractores (0-6)', pregunta.detractors, total, '#c53030')}</section>`;
  }
  if (pregunta.type === 'multiple-choice') {
    const opciones = Object.entries(pregunta.counts).sort((a, b) => b[1] - a[1]);
    const total = opciones.reduce((suma, [, cantidad]) => suma + cantidad, 0);
    return `<section class="pregunta">${titulo}${opciones.map(([opcion, cantidad]) => barra(opcion, cantidad, total, acento)).join('')}</section>`;
  }
  const comentarios = pregunta.answers.map((texto) => texto.trim()).filter(Boolean);
  const visibles = comentarios.slice(0, MAX_COMENTARIOS);
  const resto = comentarios.length - visibles.length;
  return `<section class="pregunta">${titulo}${visibles.length ? `<ul class="comentarios">${visibles.map((texto) => `<li>${escapar(texto)}</li>`).join('')}</ul>` : '<p class="vacio">Sin comentarios en este período.</p>'}${resto > 0 ? `<p class="respondieron">Y ${resto} comentario${resto === 1 ? '' : 's'} más en la plataforma.</p>` : ''}</section>`;
}

/**
 * La hoja del informe, lista para imprimir.
 *
 * Deja fuera las preguntas de datos de contacto y las marcadas como sensibles: nombre, correo,
 * teléfono o salud no tienen promedio que mostrar, y son justo lo que no debe circular.
 */
export function htmlDelInforme({ survey, resumen, periodo, promedio, completaron }: DatosDelInforme): string {
  const diseno = (survey.designConfig ?? {}) as Record<string, unknown>;
  const acento = colorSeguro(diseno.accentColor ?? diseno.primaryColor, '#ec0b61');
  const logo = typeof diseno.logoUrl === 'string' && /^https:\/\//.test(diseno.logoUrl) ? diseno.logoUrl : '';
  const privadas = new Set((survey.questions ?? []).filter((pregunta) => pregunta.dato || pregunta.sensible || pregunta.archivada).map((pregunta) => pregunta.id));
  const preguntas = resumen.questions.filter((pregunta) => !privadas.has(pregunta.questionId));
  const nps = resumen.questions.find((pregunta) => pregunta.type === 'nps');
  const generado = new Date().toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' });
  const cifras = [
    ['Respuestas', String(resumen.totalResponses)],
    ...(promedio !== null ? [['Nota promedio', promedio.toFixed(1)]] : []),
    ...(nps && nps.type === 'nps' && nps.score !== null ? [['NPS', String(nps.score)]] : []),
    ...(completaron !== null ? [['Completaron', `${completaron}%`]] : []),
  ];

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escapar(`Informe · ${survey.title}`)}</title><style>
  @page { size: A4; margin: 1.5cm 1.4cm 1.8cm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: ${TINTA}; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; font-size: 10pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .banda { height: 5px; background: ${acento}; border-radius: 3px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 16px 0 14px; border-bottom: 1px solid ${LINEA}; }
  .marca { font-size: 7.5pt; letter-spacing: .18em; text-transform: uppercase; color: ${GRIS}; margin-bottom: 6px; }
  h1 { margin: 0; font-size: 20pt; letter-spacing: -.015em; }
  .subtitulo { margin: 4px 0 0; color: ${GRIS}; }
  header img { max-height: 52px; max-width: 160px; object-fit: contain; }
  .cifras { display: grid; grid-template-columns: repeat(${Math.max(cifras.length, 1)}, 1fr); gap: 10px; margin: 18px 0 8px; }
  .cifras div { padding: 12px; border: 1px solid ${LINEA}; border-radius: 10px; background: #fbfafb; }
  .cifras span { display: block; color: ${GRIS}; font-size: 7pt; text-transform: uppercase; letter-spacing: .08em; }
  .cifras b { font-size: 20pt; color: ${acento}; font-variant-numeric: tabular-nums; }
  .pregunta { margin-top: 18px; padding-top: 12px; border-top: 1px solid ${LINEA}; page-break-inside: avoid; }
  h3 { margin: 0; font-size: 11.5pt; }
  .respondieron { margin: 2px 0 8px; color: ${GRIS}; font-size: 8.5pt; }
  .destacado { margin: 0 0 8px; color: ${GRIS}; }
  .destacado b { color: ${TINTA}; font-size: 13pt; }
  .barra { display: grid; grid-template-columns: 34% 1fr 70px; align-items: center; gap: 10px; margin: 5px 0; font-size: 9pt; }
  .barra-pista { height: 9px; border-radius: 5px; background: #f1edf0; overflow: hidden; }
  .barra-pista span { display: block; height: 100%; border-radius: 5px; }
  .barra-valor { text-align: right; color: ${GRIS}; font-variant-numeric: tabular-nums; }
  .comentarios { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
  .comentarios li { padding: 8px 10px; border-left: 3px solid ${acento}; background: #fbfafb; page-break-inside: avoid; }
  .vacio { color: ${GRIS}; }
  footer { margin-top: 22px; padding-top: 9px; border-top: 1px solid ${LINEA}; color: ${GRIS}; font-size: 7.5pt; display: flex; justify-content: space-between; gap: 16px; }
</style></head>
<body>
  <div class="banda"></div>
  <header>
    <div>
      <div class="marca">Informe de resultados</div>
      <h1>${escapar(survey.title)}</h1>
      <p class="subtitulo">${escapar(periodo)} · ${resumen.totalResponses} respuesta${resumen.totalResponses === 1 ? '' : 's'}</p>
    </div>
    ${logo ? `<img src="${escapar(logo)}" alt="">` : ''}
  </header>
  <div class="cifras">${cifras.map(([etiqueta, valor]) => `<div><span>${escapar(etiqueta)}</span><b>${escapar(valor)}</b></div>`).join('')}</div>
  ${preguntas.length ? preguntas.map((pregunta) => bloqueDePregunta(pregunta, acento)).join('') : '<p class="vacio">Todavía no hay respuestas en este período.</p>'}
  <footer><span>Sin datos de contacto: se puede compartir.</span><span>Generado el ${escapar(generado)}</span></footer>
</body></html>`;
}

/**
 * Abre el informe listo para guardar como PDF.
 *
 * @returns `false` si el navegador bloqueó la ventana, para que la pantalla lo avise.
 */
export function abrirInformeDeEncuesta(datos: DatosDelInforme): boolean {
  const ventana = window.open('', '_blank', 'width=900,height=700');
  if (!ventana) return false;
  ventana.document.write(htmlDelInforme(datos));
  ventana.document.close();
  ventana.onload = () => { ventana.focus(); ventana.print(); };
  return true;
}
