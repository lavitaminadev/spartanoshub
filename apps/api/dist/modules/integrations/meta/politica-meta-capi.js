"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TERMINOS_PROHIBIDOS = exports.CAMPOS_DE_EVENTO_PERMITIDOS = exports.DATOS_PERSONALIZADOS_PERMITIDOS = exports.IDENTIFICADORES_PERMITIDOS = void 0;
exports.revisarEvento = revisarEvento;
exports.construirEventoPermitido = construirEventoPermitido;
exports.registrarBloqueo = registrarBloqueo;
exports.resumenAuditable = resumenAuditable;
const common_1 = require("@nestjs/common");
exports.IDENTIFICADORES_PERMITIDOS = [
    'em', 'ph', 'fn', 'ln',
    'ct', 'st', 'country',
    'externalId', 'lead_id',
    'fbc', 'fbp', 'client_ip_address', 'client_user_agent',
];
exports.DATOS_PERSONALIZADOS_PERMITIDOS = [
    'currency', 'value', 'contentIds', 'contentType', 'leadEventSource', 'eventSource',
];
exports.CAMPOS_DE_EVENTO_PERMITIDOS = [
    'eventName', 'eventTime', 'eventId', 'actionSource', 'eventSourceUrl', 'userData', 'customData',
];
exports.TERMINOS_PROHIBIDOS = [
    'capacidad', 'inversion', 'inversión', 'investment', 'patrimonio', 'renta', 'income', 'sueldo',
    'salario', 'salary', 'presupuesto', 'budget', 'financ', 'deuda', 'debt', 'credito', 'crédito',
    'credit', 'banco', 'bank', 'tarjeta', 'card', 'iban', 'rut', 'dni', 'passport',
    'pasaporte', 'ssn', 'salud', 'health', 'medic', 'diagnos', 'enfermedad',
    'embarazo', 'menor', 'nino', 'niño', 'child', 'nota', 'note', 'comentario', 'comment',
    'observacion', 'observación', 'respuesta', 'answer', 'formulario', 'documento',
    'adjunto', 'attachment', 'patrimon', 'wealth', 'networth',
];
const logger = new common_1.Logger('MetaCapiPolitica');
function terminoProhibidoEn(texto) {
    const normalizado = texto.toLowerCase();
    return exports.TERMINOS_PROHIBIDOS.find((termino) => normalizado.includes(termino)) ?? null;
}
function revisarEvento(evento) {
    const infracciones = [];
    const revisarSeccion = (seccion, objeto, permitidos) => {
        if (!objeto || typeof objeto !== 'object')
            return;
        const datos = objeto;
        for (const campo of Object.keys(datos)) {
            if (datos[campo] === undefined)
                continue;
            if (permitidos.includes(campo))
                continue;
            const termino = terminoProhibidoEn(campo);
            infracciones.push({
                seccion,
                campo,
                motivo: termino
                    ? `campo fuera de la lista blanca y con término prohibido «${termino}»`
                    : 'campo fuera de la lista blanca de Meta CAPI',
            });
        }
    };
    revisarSeccion('event', evento, exports.CAMPOS_DE_EVENTO_PERMITIDOS);
    revisarSeccion('user_data', evento.userData, exports.IDENTIFICADORES_PERMITIDOS);
    revisarSeccion('custom_data', evento.customData, exports.DATOS_PERSONALIZADOS_PERMITIDOS);
    if (typeof evento.eventName === 'string') {
        const termino = terminoProhibidoEn(evento.eventName);
        if (termino) {
            infracciones.push({
                seccion: 'event',
                campo: 'eventName',
                motivo: `el nombre del evento contiene el término prohibido «${termino}»`,
            });
        }
    }
    const customData = (evento.customData ?? {});
    if (customData.value !== undefined) {
        const valor = customData.value;
        if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
            infracciones.push({ seccion: 'custom_data', campo: 'value', motivo: 'no es un importe positivo' });
        }
        else if (typeof customData.currency !== 'string' || customData.currency.length === 0) {
            infracciones.push({ seccion: 'custom_data', campo: 'value', motivo: 'viaja sin currency' });
        }
    }
    return infracciones;
}
function construirEventoPermitido(evento) {
    const copiar = (objeto, permitidos) => {
        const origen = (objeto ?? {});
        const destino = {};
        for (const campo of permitidos) {
            if (origen[campo] !== undefined)
                destino[campo] = origen[campo];
        }
        return destino;
    };
    const limpio = copiar(evento, exports.CAMPOS_DE_EVENTO_PERMITIDOS);
    limpio.userData = copiar(evento.userData, exports.IDENTIFICADORES_PERMITIDOS);
    if (evento.customData !== undefined) {
        limpio.customData = copiar(evento.customData, exports.DATOS_PERSONALIZADOS_PERMITIDOS);
    }
    return limpio;
}
function registrarBloqueo(eventId, infracciones) {
    for (const infraccion of infracciones) {
        logger.error(`META_CAPI_POLICY_BLOCKED event_id=${eventId ?? 'sin-id'} `
            + `seccion=${infraccion.seccion} campo=${infraccion.campo} motivo="${infraccion.motivo}"`);
    }
}
function resumenAuditable(evento) {
    const userData = (evento.userData ?? {});
    const customData = (evento.customData ?? {});
    const presentes = (objeto) => Object.keys(objeto).filter((campo) => objeto[campo] !== undefined).join(',') || 'ninguno';
    return (`event_name=${String(evento.eventName)} event_id=${String(evento.eventId ?? 'sin-id')} `
        + `lead_id=${userData.lead_id ? 'si' : 'no'} `
        + `email_present=${Array.isArray(userData.em) && userData.em.length > 0} `
        + `phone_present=${Array.isArray(userData.ph) && userData.ph.length > 0} `
        + `user_data=[${presentes(userData)}] custom_data=[${presentes(customData)}]`);
}
