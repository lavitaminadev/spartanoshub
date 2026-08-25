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
  email: ['email', 'work_email', 'correo', 'mail'],
  // `id` va al final: muchos sistemas mandan un `id` propio que no identifica al lead, así que
  // solo se usa cuando no vino nada más específico.
  idExterno: ['idExterno', 'lead_id', 'external_id', 'externalId', 'facebook_lead_id', 'leadgen_id', 'id'],
  campana: ['campana', 'campaign', 'utm_campaign', 'campaign_name'],
  mensaje: ['mensaje', 'message', 'notas', 'notes', 'comentario', 'observaciones'],
  empresa: ['empresa', 'company', 'company_name'],
  fechaOrigen: ['fechaOrigen', 'created_time', 'createdTime', 'created_at', 'fecha'],

  /*
    Atribución: de qué formulario, campaña, anuncio y página salió el lead.

    El CRM ya guarda estas cuatro columnas y el webhook firmado de Meta las llena. El puente no
    las mapeaba, así que un lead recibido por automatización quedaba sin saber qué anuncio lo
    produjo y el mismo lead se veía distinto según por dónde hubiera entrado. Al cambiar de
    camino, esa diferencia aparecería como un corte en los informes.

    Ninguna es obligatoria: quien no las mande sigue funcionando igual.
  */
  formId: ['formId', 'form_id'],
  campanaId: ['campanaId', 'campaign_id', 'campaignId'],
  anuncioId: ['anuncioId', 'ad_id', 'adId'],
  paginaId: ['paginaId', 'page_id', 'pageId'],
} as const;

/** Campos estables del archivo de Make que se conservan como contexto del lead. */
const CAMPOS_METADATA: Record<string, readonly string[]> = {
  firstName: ['first_name'], lastName: ['last_name'], workEmail: ['work_email'],
  dateOfBirth: ['date_of_birth'], gender: ['gender'], maritalStatus: ['marital_status'],
  relationshipStatus: ['relationship_status'], streetAddress: ['street_address'], city: ['city'],
  state: ['state'], province: ['province'], postCode: ['post_code'], country: ['country'],
  jobTitle: ['job_title'], militaryStatus: ['military_status'], pageName: ['page_name'],
  formName: ['form_name'], adsetId: ['adset_id'], adsetName: ['adset_name'],
  adName: ['ad_name'], platform: ['platform'], isOrganic: ['is_organic'],
  partnerName: ['partner_name'], retailerItemId: ['retailer_item_id'],
  sheetReceivedAt: ['fecha_ingreso_sheet'], makeScenario: ['make_scenario'],
};

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
export function normalizarCuerpoEntrada(cuerpo: Record<string, unknown>): Record<string, unknown> {
  const resultado: Record<string, unknown> = {};
  for (const [campo, claves] of Object.entries(ALIAS)) {
    const valor = primeroConValor(cuerpo, claves);
    if (valor !== undefined) resultado[campo] = valor;
  }
  // El correo se compara y se deduplica en minúsculas; normalizarlo acá evita que el mismo
  // buzón escrito con mayúsculas entre como una persona distinta.
  if (typeof resultado.email === 'string') resultado.email = resultado.email.toLowerCase();

  // Algunos escenarios separan nombre y apellido y no mandan `full_name`.
  if (!resultado.nombre) {
    const nombreCompuesto = [primeroConValor(cuerpo, ['first_name']), primeroConValor(cuerpo, ['last_name'])]
      .filter(Boolean).join(' ').trim();
    if (nombreCompuesto) resultado.nombre = nombreCompuesto;
  }

  const metadata: Record<string, unknown> = {};
  for (const [campo, aliases] of Object.entries(CAMPOS_METADATA)) {
    const valor = primeroConValor(cuerpo, aliases);
    if (valor !== undefined) metadata[campo] = valor;
  }

  // Las preguntas son variables por formulario. Se guardan en una colección y no como veinte
  // columnas rígidas, para que una pregunta nueva no requiera desplegar otra migración.
  const respuestas: Array<{ question: string; answer: string }> = [];
  for (let indice = 1; indice <= 10; indice += 1) {
    const question = primeroConValor(cuerpo, [`pregunta_${indice}`]);
    const answer = primeroConValor(cuerpo, [`respuesta_${indice}`]);
    if (question || answer) respuestas.push({ question: question ?? `Pregunta ${indice}`, answer: answer ?? '' });
  }
  if (respuestas.length) metadata.answers = respuestas;

  const customFields = parsearCamposPersonalizados(cuerpo.custom_fields_json);
  if (customFields.length) metadata.customFields = customFields;

  /*
   * `raw_lead_json` se ignora intencionalmente: duplica nombre, teléfono, correo y respuestas,
   * aumenta la exposición de datos personales y no aporta información que no esté ya arriba.
   * También se ignoran `api_ok`, `api_lead_id`, `api_source`, `api_campaign` y `error_api`:
   * son columnas de salida de Make, no datos del lead.
   */
  if (Object.keys(metadata).length) resultado.metadata = metadata;
  return resultado;
}

function parsearCamposPersonalizados(valor: unknown): Array<{ name: string; value: string }> {
  if (typeof valor !== 'string' || !valor.trim() || valor.length > 20_000) return [];
  const texto = valor.trim();
  for (const candidato of [texto, `[${texto}]`]) {
    try {
      const parsed: unknown = JSON.parse(candidato);
      if (!Array.isArray(parsed)) continue;
      return parsed.slice(0, 50).flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const record = item as Record<string, unknown>;
        const name = typeof record.name === 'string' ? record.name.trim() : '';
        const fieldValue = typeof record.value === 'string' ? record.value.trim() : '';
        return name ? [{ name: name.slice(0, 500), value: fieldValue.slice(0, 2000) }] : [];
      });
    } catch {
      // Make suele entregar una secuencia de objetos sin corchetes; se prueba la segunda forma.
    }
  }
  return [];
}
