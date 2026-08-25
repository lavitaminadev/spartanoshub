"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizarCuerpoEntrada = normalizarCuerpoEntrada;
const ALIAS = {
    nombre: ['nombre', 'name', 'full_name', 'fullName'],
    telefono: ['telefono', 'phone', 'celular', 'mobile', 'phone_number'],
    email: ['email', 'work_email', 'correo', 'mail'],
    idExterno: ['idExterno', 'lead_id', 'external_id', 'externalId', 'facebook_lead_id', 'leadgen_id', 'id'],
    campana: ['campana', 'campaign', 'utm_campaign', 'campaign_name'],
    mensaje: ['mensaje', 'message', 'notas', 'notes', 'comentario', 'observaciones'],
    empresa: ['empresa', 'company', 'company_name'],
    fechaOrigen: ['fechaOrigen', 'created_time', 'createdTime', 'created_at', 'fecha'],
    formId: ['formId', 'form_id'],
    campanaId: ['campanaId', 'campaign_id', 'campaignId'],
    anuncioId: ['anuncioId', 'ad_id', 'adId'],
    paginaId: ['paginaId', 'page_id', 'pageId'],
};
const CAMPOS_METADATA = {
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
function primeroConValor(cuerpo, claves) {
    for (const clave of claves) {
        const valor = cuerpo[clave];
        if (typeof valor === 'string' && valor.trim())
            return valor.trim();
        if (typeof valor === 'number')
            return String(valor);
    }
    return undefined;
}
function normalizarCuerpoEntrada(cuerpo) {
    const resultado = {};
    for (const [campo, claves] of Object.entries(ALIAS)) {
        const valor = primeroConValor(cuerpo, claves);
        if (valor !== undefined)
            resultado[campo] = valor;
    }
    if (typeof resultado.email === 'string')
        resultado.email = resultado.email.toLowerCase();
    if (!resultado.nombre) {
        const nombreCompuesto = [primeroConValor(cuerpo, ['first_name']), primeroConValor(cuerpo, ['last_name'])]
            .filter(Boolean).join(' ').trim();
        if (nombreCompuesto)
            resultado.nombre = nombreCompuesto;
    }
    const metadata = {};
    for (const [campo, aliases] of Object.entries(CAMPOS_METADATA)) {
        const valor = primeroConValor(cuerpo, aliases);
        if (valor !== undefined)
            metadata[campo] = valor;
    }
    const respuestas = [];
    for (let indice = 1; indice <= 10; indice += 1) {
        const question = primeroConValor(cuerpo, [`pregunta_${indice}`]);
        const answer = primeroConValor(cuerpo, [`respuesta_${indice}`]);
        if (question || answer)
            respuestas.push({ question: question ?? `Pregunta ${indice}`, answer: answer ?? '' });
    }
    if (respuestas.length)
        metadata.answers = respuestas;
    const customFields = parsearCamposPersonalizados(cuerpo.custom_fields_json);
    if (customFields.length)
        metadata.customFields = customFields;
    if (Object.keys(metadata).length)
        resultado.metadata = metadata;
    return resultado;
}
function parsearCamposPersonalizados(valor) {
    if (typeof valor !== 'string' || !valor.trim() || valor.length > 20_000)
        return [];
    const texto = valor.trim();
    for (const candidato of [texto, `[${texto}]`]) {
        try {
            const parsed = JSON.parse(candidato);
            if (!Array.isArray(parsed))
                continue;
            return parsed.slice(0, 50).flatMap((item) => {
                if (!item || typeof item !== 'object')
                    return [];
                const record = item;
                const name = typeof record.name === 'string' ? record.name.trim() : '';
                const fieldValue = typeof record.value === 'string' ? record.value.trim() : '';
                return name ? [{ name: name.slice(0, 500), value: fieldValue.slice(0, 2000) }] : [];
            });
        }
        catch {
        }
    }
    return [];
}
