"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.servicioDelAviso = servicioDelAviso;
exports.avisosVisibles = avisosVisibles;
function servicioDelAviso(tipo) {
    if (tipo.startsWith('reservation_') || tipo.startsWith('waitlist'))
        return 'reservations';
    if (tipo.startsWith('lead_') || tipo.startsWith('crm_') || tipo === 'idle_lead')
        return 'crm';
    if (tipo.startsWith('survey'))
        return 'surveys';
    return null;
}
async function avisosVisibles(avisos, organizationId, user, accesos, servicios) {
    const conEmpresa = avisos.filter((aviso) => typeof aviso.data?.clientId === 'string');
    if (!conEmpresa.length || (!accesos && !servicios))
        return avisos;
    const alcanzables = accesos ? await accesos.allowedClientIds(organizationId, user) : undefined;
    const decidido = new Map();
    const visible = async (clientId, servicio) => {
        const clave = `${clientId}:${servicio ?? '-'}`;
        if (!decidido.has(clave)) {
            const alcanza = !alcanzables || alcanzables.includes(clientId);
            const conServicio = !servicio || !servicios || await servicios.tiene(organizationId, clientId, servicio);
            decidido.set(clave, alcanza && conServicio);
        }
        return decidido.get(clave);
    };
    const resultado = [];
    for (const aviso of avisos) {
        const clientId = aviso.data?.clientId;
        if (typeof clientId !== 'string' || await visible(clientId, servicioDelAviso(aviso.type)))
            resultado.push(aviso);
    }
    return resultado;
}
