"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION_CONSENTIMIENTO_ENCUESTA = void 0;
exports.consentimientoDeEncuesta = consentimientoDeEncuesta;
exports.aceptacionAGuardar = aceptacionAGuardar;
exports.contactoEscrito = contactoEscrito;
const shared_1 = require("@espartanos/shared");
exports.VERSION_CONSENTIMIENTO_ENCUESTA = 'survey-v1';
async function consentimientoDeEncuesta(db, survey) {
    if (!(0, shared_1.pideDatosPersonales)(survey.questions ?? []))
        return null;
    let empresa;
    if (survey.clientId) {
        const filas = await db.query('SELECT name, legal_name, privacy_email, privacy_url, legal_mode, privacy_text FROM clients WHERE id = ? LIMIT 1', [survey.clientId]).catch(() => []);
        empresa = filas?.[0];
    }
    const responsable = empresa?.legal_name?.trim() || empresa?.name?.trim() || 'Espartanos';
    const correo = empresa?.privacy_email?.trim();
    const porEncargo = empresa ? ` La plataforma Espartanos los trata por encargo de ${responsable}.` : '';
    const derechos = correo
        ? ` Puedo pedir acceso, corrección o eliminación escribiendo a ${correo}.`
        : ' Puedo pedir acceso, corrección o eliminación de mis datos.';
    const texto = `Acepto que ${responsable} use los datos que dejo en esta encuesta para conocer mi opinión y, si corresponde, contactarme sobre ella. Se conservan mientras sirvan a ese fin.${derechos}${porEncargo}`;
    const modoTexto = empresa?.legal_mode === 'texto';
    return {
        texto,
        version: exports.VERSION_CONSENTIMIENTO_ENCUESTA,
        responsable,
        privacyUrl: modoTexto ? null : empresa?.privacy_url || null,
        privacyText: modoTexto ? empresa?.privacy_text || null : null,
    };
}
async function aceptacionAGuardar(db, survey, respuestas, acepta) {
    if (!(0, shared_1.traeDatosPersonales)(survey.questions ?? [], respuestas))
        return {};
    if (acepta !== true)
        throw new Error('Para enviar tus datos tienes que aceptar su uso');
    const consentimiento = await consentimientoDeEncuesta(db, survey);
    return consentimiento ? { privacyConsentAt: new Date(), privacyConsentText: `[${consentimiento.version}] ${consentimiento.texto}` } : {};
}
function contactoEscrito(questions, respuestas) {
    const valor = (dato) => {
        const pregunta = questions.find((item) => item.dato === dato);
        const escrito = pregunta ? respuestas[pregunta.id] : undefined;
        return typeof escrito === 'string' && escrito.trim() ? escrito.trim() : undefined;
    };
    return { nombre: valor('nombre')?.slice(0, 180), correo: valor('correo')?.slice(0, 190) };
}
