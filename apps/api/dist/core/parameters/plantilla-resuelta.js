"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leerPlantilla = leerPlantilla;
async function leerPlantilla(parametros, prefijo, alcance, respaldo, opciones = {}) {
    const { clientId = null, organizationId = null, formId = null } = alcance;
    const conInterruptor = opciones.encendidoPorDefecto !== null;
    const [asunto, cuerpo, interruptor] = await Promise.all([
        parametros.get(`${prefijo}_subject`, clientId, null, organizationId, formId),
        parametros.get(`${prefijo}_body`, clientId, null, organizationId, formId),
        conInterruptor ? parametros.get(`${prefijo}_enabled`, clientId, null, organizationId, formId) : Promise.resolve(true),
    ]);
    const texto = { asunto: String(asunto ?? '') || respaldo.asunto, cuerpo: String(cuerpo ?? '') || respaldo.cuerpo };
    const completo = (opciones.obligatorias ?? []).every((variable) => new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`).test(`${texto.asunto} ${texto.cuerpo}`));
    return {
        encendido: interruptor === null || interruptor === undefined ? (opciones.encendidoPorDefecto ?? true) : Boolean(interruptor),
        ...(completo ? texto : respaldo),
    };
}
