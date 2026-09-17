"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCIONES = void 0;
exports.definicionDeAccion = definicionDeAccion;
exports.ACCIONES = [
    { clave: 'crm.importar', modulo: 'crm', nombre: 'Importar leads', ayuda: 'Subir contactos desde un archivo.', nivelPorDefecto: 'edit' },
    { clave: 'crm.borrar', modulo: 'crm', nombre: 'Borrar oportunidades', ayuda: 'Eliminar una oportunidad del embudo.', nivelPorDefecto: 'manage' },
    { clave: 'reservations.configurar', modulo: 'reservations', nombre: 'Configurar la reserva', ayuda: 'Horario semanal, campos, textos legales, medición y publicación. Cerrarlo deja los ajustes del día a día, que se cambian desde la propia pantalla.', nivelPorDefecto: 'edit' },
    { clave: 'reservations.exportar', modulo: 'reservations', nombre: 'Exportar reservas', ayuda: 'Descargar reservas con datos de contacto.', nivelPorDefecto: 'edit' },
    { clave: 'reservations.importar', modulo: 'reservations', nombre: 'Importar reservas', ayuda: 'Cargar reservas desde un archivo.', nivelPorDefecto: 'edit' },
    { clave: 'surveys.enviar', modulo: 'surveys', nombre: 'Enviar encuestas por correo', ayuda: 'Mandar la encuesta a sus destinatarios.', nivelPorDefecto: 'edit' },
    { clave: 'surveys.borrar', modulo: 'surveys', nombre: 'Eliminar encuestas', ayuda: 'Borrar una encuesta con todas sus respuestas.', nivelPorDefecto: 'manage' },
];
const POR_CLAVE = new Map(exports.ACCIONES.map((accion) => [accion.clave, accion]));
function definicionDeAccion(clave) {
    return POR_CLAVE.get(clave);
}
