import type { CustomFieldDefinition, CustomFieldValues } from '@espartanos/shared';

/**
 * @fileoverview Lleva las respuestas de un formulario externo a los campos propios del CRM.
 *
 * Los formularios externos —Meta, la web, una automatización— mandan pares pregunta/valor con el nombre que puso quien armó el
 * anuncio, y ese nombre cambia entre campañas: «presupuesto», «Cuál es tu presupuesto», «¿Cuánto
 * inviertes hoy?». Cada campo propio declara qué preguntas lo llenan, y acá se comparan sin
 * tildes, signos ni mayúsculas para que una diferencia de redacción no rompa la equivalencia.
 *
 * Lo que no coincide con ningún campo sigue yendo a las notas, como siempre: una respuesta que
 * nadie pidió guardar no se pierde por no estar mapeada.
 */

/** Una respuesta del formulario, ya aplanada por la captura. */
export type RespuestaDeFormulario = { nombre: string; valor: string };

/** Deja un texto comparable: sin tildes, sin signos y en minúsculas. */
export function comparable(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Definición de campo propio con las preguntas que la llenan. */
export type CampoConPreguntas = CustomFieldDefinition & { metaQuestions?: string[] | null };

/**
 * Convierte el valor de Meta al tipo del campo. Devuelve `undefined` si no encaja, y entonces la
 * respuesta se queda en las notas: guardar «mucho» en un campo numérico ensucia el dato y rompe
 * los filtros que ese campo debía habilitar.
 */
function valorParaElCampo(campo: CampoConPreguntas, crudo: string): CustomFieldValues[string] | undefined {
  const texto = crudo.trim();
  if (!texto) return undefined;

  if (campo.type === 'number') {
    // Sin ningún dígito no hay número: «lo que sea necesario» se limpiaría hasta quedar vacío,
    // y una cadena vacía se convierte en cero, que es un dato falso.
    if (!/\d/.test(texto)) return undefined;
    const numero = Number(texto.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
    return Number.isFinite(numero) ? numero : undefined;
  }
  if (campo.type === 'boolean') {
    const si = ['si', 'sisi', 'yes', 'true', '1'].includes(comparable(texto));
    const no = ['no', 'false', '0'].includes(comparable(texto));
    return si ? true : no ? false : undefined;
  }
  if (campo.type === 'date') {
    const fecha = new Date(texto);
    return Number.isNaN(fecha.getTime()) ? undefined : fecha.toISOString().slice(0, 10);
  }
  if (campo.type === 'select' || campo.type === 'multi_select') {
    const opciones = campo.options ?? [];
    const elegidas = texto.split(/[,;|]/)
      .map((parte) => opciones.find((opcion) => comparable(opcion) === comparable(parte)))
      .filter((opcion): opcion is string => Boolean(opcion));
    if (elegidas.length === 0) return undefined;
    return campo.type === 'select' ? elegidas[0] : [...new Set(elegidas)];
  }
  return texto.slice(0, campo.type === 'long_text' ? 4000 : 255);
}

/**
 * Reparte las respuestas de Meta entre los campos propios y lo que queda para las notas.
 *
 * @param definiciones - Campos propios de leads, ya sin los archivados.
 * @param respuestas - Lo que contestó la persona, con el nombre de pregunta tal como llega.
 * @returns Los valores de campos propios y las respuestas que no encontraron campo.
 */
export function repartirRespuestas(
  definiciones: CampoConPreguntas[],
  respuestas: RespuestaDeFormulario[],
): { camposPropios: CustomFieldValues; sinCampo: RespuestaDeFormulario[] } {
  const porPregunta = new Map<string, CampoConPreguntas>();
  for (const campo of definiciones) {
    if (campo.archivedAt) continue;
    // La clave del campo también sirve de equivalencia: un formulario que pregunta «presupuesto»
    // llena el campo `presupuesto` sin configurar nada.
    for (const pregunta of [campo.key, ...(campo.metaQuestions ?? [])]) {
      const llave = comparable(pregunta);
      if (llave && !porPregunta.has(llave)) porPregunta.set(llave, campo);
    }
  }

  const camposPropios: CustomFieldValues = {};
  const sinCampo: RespuestaDeFormulario[] = [];
  for (const respuesta of respuestas) {
    const campo = porPregunta.get(comparable(respuesta.nombre));
    const valor = campo ? valorParaElCampo(campo, respuesta.valor) : undefined;
    if (campo && valor !== undefined) camposPropios[campo.key] = valor;
    else sinCampo.push(respuesta);
  }
  return { camposPropios, sinCampo };
}
