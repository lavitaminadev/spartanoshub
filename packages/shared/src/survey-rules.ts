/**
 * @fileoverview Reglas de una encuesta que deben dar lo mismo en la página pública y en el servidor.
 *
 * Qué preguntas se muestran según lo contestado, cuáles son obligatorias en ese momento y si un
 * dato de contacto está bien escrito. Vive aquí para que la página nunca exija algo que el
 * servidor no pide, ni el servidor rechace algo que la página dejó enviar.
 */

import type { SurveyContactField, SurveyQuestion } from './types/survey';

type Respuestas = Record<string, string | number | undefined | null>;

/** Nombre visible y tipo de campo de cada dato de contacto. */
export const DATOS_DE_CONTACTO: Record<SurveyContactField, { etiqueta: string; pregunta: string; placeholder: string; autocompletar: string; tipo: 'text' | 'email' | 'tel' | 'date' }> = {
  nombre: { etiqueta: 'Nombre', pregunta: 'Tu nombre', placeholder: 'Nombre y apellido', autocompletar: 'name', tipo: 'text' },
  rut: { etiqueta: 'RUT', pregunta: 'Tu RUT', placeholder: '12.345.678-9', autocompletar: 'off', tipo: 'text' },
  correo: { etiqueta: 'Correo', pregunta: 'Tu correo', placeholder: 'nombre@correo.cl', autocompletar: 'email', tipo: 'email' },
  telefono: { etiqueta: 'Teléfono', pregunta: 'Tu teléfono', placeholder: '+56 9 1234 5678', autocompletar: 'tel', tipo: 'tel' },
  nacimiento: { etiqueta: 'Fecha de nacimiento', pregunta: 'Tu fecha de nacimiento', placeholder: 'dd-mm-aaaa', autocompletar: 'bday', tipo: 'date' },
};

/** Orden en que se piden los datos: el mismo en el editor, la página y los resultados. */
export const ORDEN_DE_DATOS: SurveyContactField[] = ['nombre', 'rut', 'nacimiento', 'correo', 'telefono'];

/**
 * Preguntas en el orden en que se muestran: primero los datos de quien responde, en su orden fijo,
 * y después las preguntas en el orden que les dio el equipo. Así los datos no quedan perdidos al
 * final de una encuesta larga.
 */
export function ordenarParaMostrar<T extends SurveyQuestion>(preguntas: T[]): T[] {
  const datos = preguntas.filter((pregunta) => pregunta.dato).sort((a, b) => ORDEN_DE_DATOS.indexOf(a.dato!) - ORDEN_DE_DATOS.indexOf(b.dato!));
  return [...datos, ...preguntas.filter((pregunta) => !pregunta.dato)];
}

/** Fecha de nacimiento válida: formato AAAA-MM-DD, no futura y desde 1900. */
function nacimientoValido(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T12:00:00`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto) return false;
  return fecha.getFullYear() >= 1900 && fecha.getTime() <= Date.now();
}

function vacia(valor: unknown): boolean {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

/**
 * Si una pregunta se muestra con las respuestas actuales.
 *
 * Una pregunta con `mostrarSi` sólo aparece cuando la pregunta de la que depende tiene uno de los
 * valores elegidos. Si esa pregunta a su vez está oculta, ésta también: una cadena de reglas no
 * puede mostrar algo cuyo origen nadie vio.
 */
export function preguntaVisible(pregunta: SurveyQuestion, preguntas: SurveyQuestion[], respuestas: Respuestas, visitadas = new Set<string>()): boolean {
  const regla = pregunta.mostrarSi;
  if (!regla?.preguntaId || !regla.valores?.length) return true;
  if (visitadas.has(pregunta.id)) return false;
  visitadas.add(pregunta.id);
  const origen = preguntas.find((item) => item.id === regla.preguntaId);
  if (!origen || !preguntaVisible(origen, preguntas, respuestas, visitadas)) return false;
  const valor = respuestas[origen.id];
  return !vacia(valor) && regla.valores.map(String).includes(String(valor));
}

/** Las preguntas que ve la persona con lo que lleva contestado, en orden. */
export function preguntasVisibles(preguntas: SurveyQuestion[], respuestas: Respuestas): SurveyQuestion[] {
  return preguntas.filter((pregunta) => preguntaVisible(pregunta, preguntas, respuestas));
}

/** Valida el dígito verificador de un RUT chileno. Acepta puntos, guion y K minúscula. */
export function rutValido(valor: string): boolean {
  const limpio = valor.replace(/[.\s-]/g, '').toUpperCase();
  if (!/^\d{7,8}[\dK]$/.test(limpio)) return false;
  const cuerpo = limpio.slice(0, -1);
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return limpio.slice(-1) === esperado;
}

/** Da formato 12.345.678-9 a un RUT escrito de cualquier forma. */
export function formatearRut(valor: string): string {
  const limpio = valor.replace(/[^\dkK]/g, '').toUpperCase().slice(0, 9);
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpo}-${limpio.slice(-1)}`;
}

/** Mensaje de error de un dato de contacto, o `null` si está bien o vacío. */
export function errorDeDato(dato: SurveyContactField | undefined, valor: unknown): string | null {
  if (!dato || vacia(valor)) return null;
  const texto = String(valor).trim();
  if (dato === 'rut' && !rutValido(texto)) return 'El RUT no es válido';
  if (dato === 'correo' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(texto)) return 'El correo no es válido';
  if (dato === 'telefono' && texto.replace(/\D/g, '').length < 8) return 'El teléfono no es válido';
  if (dato === 'nombre' && texto.length < 2) return 'Escribe tu nombre';
  if (dato === 'nacimiento' && !nacimientoValido(texto)) return 'La fecha de nacimiento no es válida';
  return null;
}

/**
 * Qué falta o está mal en lo contestado, considerando sólo las preguntas visibles.
 *
 * @param omitir Preguntas que no se exigen en este envío (por ejemplo, la nota del flujo por pasos).
 * @returns Una lista de textos listos para mostrar; vacía si se puede enviar.
 */
export function problemasDeRespuesta(preguntas: SurveyQuestion[], respuestas: Respuestas, omitir: string[] = []): string[] {
  const problemas: string[] = [];
  for (const pregunta of preguntasVisibles(preguntas, respuestas)) {
    if (omitir.includes(pregunta.id)) continue;
    const valor = respuestas[pregunta.id];
    if (pregunta.required && vacia(valor)) { problemas.push(`Falta: ${pregunta.question}`); continue; }
    const error = errorDeDato(pregunta.dato, valor);
    if (error) problemas.push(error);
  }
  return problemas;
}

/** Si la encuesta pide algún dato que identifica a la persona: entonces se necesita su aceptación. */
export function pideDatosPersonales(preguntas: SurveyQuestion[]): boolean {
  return preguntas.some((pregunta) => Boolean(pregunta.dato));
}

/** Si en lo contestado viene algún dato personal escrito. */
export function traeDatosPersonales(preguntas: SurveyQuestion[], respuestas: Respuestas): boolean {
  return preguntas.some((pregunta) => pregunta.dato && !vacia(respuestas[pregunta.id]));
}
