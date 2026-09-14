"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encuestasHabilitadas = encuestasHabilitadas;
exports.exigirEncuestasHabilitadas = exigirEncuestasHabilitadas;
exports.encuestaPublicaDisponible = encuestaPublicaDisponible;
const common_1 = require("@nestjs/common");
const client_capabilities_1 = require("../clients/client-capabilities");
async function encuestasHabilitadas(db, clientId) {
    if (!clientId)
        return true;
    const filas = await db.query('SELECT capabilities FROM clients WHERE id = ? LIMIT 1', [clientId]);
    const cruda = filas?.[0]?.capabilities;
    let valor = null;
    try {
        valor = typeof cruda === 'string' ? JSON.parse(cruda) : cruda ?? null;
    }
    catch {
        valor = null;
    }
    return (0, client_capabilities_1.normalizeClientCapabilities)(valor).surveys;
}
async function exigirEncuestasHabilitadas(db, clientId) {
    if (!(await encuestasHabilitadas(db, clientId)))
        throw new common_1.ForbiddenException('Encuestas no está habilitado para esta empresa');
}
async function encuestaPublicaDisponible(db, clientId) {
    if (!(await encuestasHabilitadas(db, clientId)))
        throw new common_1.NotFoundException('La encuesta no está disponible');
}
