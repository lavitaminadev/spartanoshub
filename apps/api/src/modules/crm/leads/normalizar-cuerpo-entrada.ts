/**
 * @fileoverview Traduce el cuerpo de un sistema externo a los campos que entiende el CRM.
 *
 * Existe porque los alias no se pueden resolver con `@Transform` en el DTO. Un transformador de
 * `class-transformer` solo se ejecuta si la propiedad de destino **ya viene** en el objeto: un
 * cuerpo que trae `full_name` y no `nombre` nunca dispara el transformador de `nombre`, así que
 * el campo quedaba vacío y la validación respondía «Falta el nombre» sobre un cuerpo que sí lo
 * traía. Era el caso de Meta, que es la integración principal.
 *
 * Traducir acá, antes de validar, hace el paso visible y comprobable sin depender del orden en
 * que `class-transformer` recorre las claves.
 */

/** Nombres que cada campo puede traer, del más específico al más genérico. */
const ALIAS = {
  nombre: ['nombre', 'name', 'full_name', 'fullName'],
  telefono: ['telefono', 'phone', 'celular', 'mobile', 'phone_number'],
  email: ['email', 'correo', 'mail'],
  // `id` va al final: muchos sistemas mandan un `id` propio que no identifica al lead, así que
  // solo se usa cuando no vino nada más específico.
  idExterno: ['idExterno', 'external_id', 'externalId', 'facebook_lead_id', 'leadgen_id', 'id'],
  campana: ['campana', 'campaign', 'utm_campaign', 'campaign_name'],
  mensaje: ['mensaje', 'message', 'notas', 'notes', 'comentario'],
  fechaOrigen: ['fechaOrigen', 'created_time', 'createdTime', 'created_at', 'fecha'],
} as const;

/** Primer valor con contenido, recortado. Un texto en blanco cuenta como ausente. */
function primeroConValor(cuerpo: Record<string, unknown>, claves: readonly string[]): string | undefined {
  for (const clave of claves) {
    const valor = cuerpo[clave];
    if (typeof valor === 'string' && valor.trim()) return valor.trim();
    if (typeof valor === 'number') return String(valor);
  }
  return undefined;
}

/**
 * Deja el cuerpo con los nombres que espera `IngestLeadDto`.
 *
 * Lo que no reconoce se descarta: Meta agrega `form_id`, `ad_id` y una entrada por cada pregunta
 * del formulario, y esas preguntas las cambia quien crea el anuncio. Arrastrarlas al dominio
 * sería guardar datos que nadie pidió.
 *
 * @param cuerpo - Lo que llegó, tal cual.
 */
export function normalizarCuerpoEntrada(cuerpo: Record<string, unknown>): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const [campo, claves] of Object.entries(ALIAS)) {
    const valor = primeroConValor(cuerpo, claves);
    if (valor !== undefined) resultado[campo] = valor;
  }
  // El correo se compara y se deduplica en minúsculas; normalizarlo acá evita que el mismo
  // buzón escrito con mayúsculas entre como una persona distinta.
  if (resultado.email) resultado.email = resultado.email.toLowerCase();
  return resultado;
}
