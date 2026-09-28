"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MUESTRA = void 0;
function enDias(dias, conHora = false) {
    const fecha = new Date(Date.now() + dias * 86_400_000);
    const dia = fecha.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', weekday: conHora ? 'long' : undefined, day: 'numeric', month: 'long', year: 'numeric' });
    return conHora ? `${dia}, 20:30` : dia;
}
exports.MUESTRA = {
    responsable: 'María',
    nombre: 'Ana Pérez',
    lead: 'Ana Pérez',
    local: 'Restaurante de ejemplo',
    fecha: enDias(3, true),
    personas: 4,
    codigo: 'ABC-1234',
    motivo: 'Motivo: cierre por evento privado.',
    cupon: 'BIENVENIDA10',
    vence: enDias(30),
    origen: 'Meta Lead Ads',
    campana: 'Campaña de ejemplo',
    telefono: '+56 9 1234 5678',
    correo: 'ana.perez@ejemplo.cl',
    etapa: 'Contactado - Recontactar',
    dias: 5,
    pendientes: 3,
    parados: 2,
    nuevos: 7,
    tarea: 'Llamar para confirmar la visita',
    cuando: 'hoy 18:00',
    horas: 3,
};
