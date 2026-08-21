"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizarCuerpoEntrada = normalizarCuerpoEntrada;
const ALIAS = {
    nombre: ['nombre', 'name', 'full_name', 'fullName'],
    telefono: ['telefono', 'phone', 'celular', 'mobile', 'phone_number'],
    email: ['email', 'correo', 'mail'],
    idExterno: ['idExterno', 'external_id', 'externalId', 'facebook_lead_id', 'leadgen_id', 'id'],
    campana: ['campana', 'campaign', 'utm_campaign', 'campaign_name'],
    mensaje: ['mensaje', 'message', 'notas', 'notes', 'comentario'],
    fechaOrigen: ['fechaOrigen', 'created_time', 'createdTime', 'created_at', 'fecha'],
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
    if (resultado.email)
        resultado.email = resultado.email.toLowerCase();
    return resultado;
}
