"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION_CONSENTIMIENTO_ENCUESTA = void 0;
exports.consentimientoDeEncuesta = consentimientoDeEncuesta;
exports.aceptacionAGuardar = aceptacionAGuardar;
exports.contactoEscrito = contactoEscrito;
exports.exigirIdentidadLegalDeEncuesta = exigirIdentidadLegalDeEncuesta;
const common_1 = require("@nestjs/common");
const shared_1 = require("@espartanos/shared");
exports.VERSION_CONSENTIMIENTO_ENCUESTA = 'survey-v2';
async function consentimientoDeEncuesta(db, survey) {
    if (!(0, shared_1.pideDatosPersonales)(survey.questions ?? []))
        return null;
    let empresa;
    if (survey.clientId) {
        const filas = await db.query('SELECT name, legal_name, tax_id, privacy_email, privacy_url, legal_mode, privacy_text FROM clients WHERE id = ? LIMIT 1', [survey.clientId]).catch(() => []);
        empresa = filas?.[0];
    }
    const responsable = empresa
        ? (0, shared_1.nombreLegalDelLocal)({ razonSocial: empresa.legal_name, rut: empresa.tax_id, nombreComercial: empresa.name })
        : (0, shared_1.nombreLegalDelOperador)();
    const correo = empresa?.privacy_email?.trim() || shared_1.OPERADOR_ESPARTANOS.correo;
    const porEncargo = empresa ? ` La plataforma ${shared_1.OPERADOR_ESPARTANOS.marca} los trata por encargo de ${responsable}.` : '';
    const sensibles = (0, shared_1.pideDatosSensibles)(survey.questions ?? [])
        ? ` Autorizo expresamente el uso de la información de salud o alimentación que indique sólo para atender mi respuesta; no se usa para publicidad ni se comparte con terceros.`
        : '';
    const texto = `Acepto que ${responsable} use los datos que dejo en esta encuesta para conocer mi opinión y, si corresponde, contactarme sobre ella. Se conservan hasta ${shared_1.PLAZOS_DE_CONSERVACION.encuestasMeses} meses y luego se anonimizan. Puedo ejercer mis derechos de acceso, rectificación, supresión, oposición, portabilidad y bloqueo escribiendo a ${correo}, y reclamar ante la Agencia de Protección de Datos Personales.${sensibles}${porEncargo}`;
    const modoTexto = empresa?.legal_mode === 'texto';
    return {
        texto,
        version: exports.VERSION_CONSENTIMIENTO_ENCUESTA,
        responsable,
        identidad: empresa ? { razonSocial: empresa.legal_name, rut: empresa.tax_id, correo: empresa.privacy_email, nombreComercial: empresa.name } : null,
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
async function exigirIdentidadLegalDeEncuesta(db, clientId, preguntas) {
    if (!clientId || !(0, shared_1.pideDatosPersonales)(preguntas ?? []))
        return;
    const filas = await db.query('SELECT legal_name, tax_id, privacy_email FROM clients WHERE id = ? LIMIT 1', [clientId]);
    const empresa = filas?.[0];
    const faltan = (0, shared_1.faltantesDeIdentidadLegal)({ razonSocial: empresa?.legal_name, rut: empresa?.tax_id, correo: empresa?.privacy_email });
    if (faltan.length)
        throw new common_1.BadRequestException((0, shared_1.mensajeDeIdentidadIncompleta)(faltan));
}
