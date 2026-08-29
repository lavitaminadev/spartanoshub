"use strict";
/**
 * @fileoverview Lead domain types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPPORTUNITY_LOSS_REASONS = exports.LEAD_DISCARD_REASONS = exports.LEAD_SOURCES = exports.LEAD_TRAFFIC_LIGHTS = exports.STAGE_LABELS_BY_KEY = exports.LEAD_FIT_STATUSES = exports.LEAD_STATUSES_BY_DOMAIN = exports.LEAD_STATUSES = exports.LEAD_CLOSING_STAGES = exports.LEAD_RESERVATION_OUTCOMES = exports.LEAD_PIPELINE_STAGES = void 0;
exports.etiquetaDeFuente = etiquetaDeFuente;
/**
 * Etapas del pipeline comercial. El equipo las mueve a mano y son ordenadas:
 * el orden de este arreglo es el orden de las columnas del tablero.
 */
exports.LEAD_PIPELINE_STAGES = [
    'new',
    'contacted',
    'quote_sent',
    'meeting_scheduled',
    // Se agendo la visita y ademas ocurrio. Son dos hechos distintos y el equipo los trabaja
    // distinto: uno espera a que llegue la fecha, el otro espera una respuesta.
    'negotiation',
];
/**
 * Resultados del ciclo de reserva. Los escribe el sistema, no el equipo:
 * `reserved` al crearse la reserva y `attended` / `no_show` al registrar la
 * asistencia. No son etapas del pipeline y no se arrastran.
 */
exports.LEAD_RESERVATION_OUTCOMES = [
    'reserved',
    'attended',
    'no_show',
];
/**
 * Cierres del pipeline comercial.
 */
exports.LEAD_CLOSING_STAGES = ['won', 'lost'];
/**
 * Universo completo de estados aceptados. Es la unica fuente de verdad: el enum
 * del backend y las columnas del tablero derivan de aca para que no se
 * desincronicen.
 */
exports.LEAD_STATUSES = [
    ...exports.LEAD_PIPELINE_STAGES,
    ...exports.LEAD_RESERVATION_OUTCOMES,
    ...exports.LEAD_CLOSING_STAGES,
];
/**
 * Que estados admite cada embudo, en el orden en que se recorren.
 *
 * **Es la fuente unica.** El enum de la API, el reparto por dominio, las columnas del tablero y
 * la paleta de estados derivan de aca. Estuvieron declarados por separado en cinco sitios, y esa
 * duplicacion costo dos fallos silenciosos: faltaban estados en un embudo y 'lost' en
 * el de campana, asi que los leads en esos estados no tenian columna donde dibujarse. No fallaba
 * nada; simplemente desaparecian de la pantalla.
 *
 * Los dos embudos comparten 'new' y 'lost' a proposito: todo lead nace nuevo, y tanto una venta
 * que no se gano como una visita que no ocurrio se cierran igual.
 */
exports.LEAD_STATUSES_BY_DOMAIN = {
    commercial: [...exports.LEAD_PIPELINE_STAGES, ...exports.LEAD_CLOSING_STAGES],
    audience: ['new', ...exports.LEAD_RESERVATION_OUTCOMES, 'lost'],
};
/**
 * Calificación de un lead, de indecisa a decidida.
 *
 * `review` es el estado en que nace: nadie lo ha mirado todavía. `in_review` es distinto y por
 * eso existe aparte: alguien ya habló con esta persona y **aún no decide**. Con un solo estado
 * intermedio no se distingue el lead que nadie tocó del que está en conversación, que es
 * justamente lo que hay que saber para repartir el trabajo del día.
 */
exports.LEAD_FIT_STATUSES = ['qualified', 'in_review', 'review', 'unqualified'];
/**
 * Cómo se lee cada etapa fuera de la aplicación.
 *
 * Existe acá y no en el frontend porque también lo usa el servidor: los eventos de etapa que se
 * reportan a Meta llevan el nombre legible, y en sus informes se muestra tal cual: mandar
 * `quote_sent` obligaría a traducir mentalmente en una pantalla que no es nuestra.
 *
 * Es el rótulo de fábrica, no el que cada empresa haya renombrado: si dos empresas llaman
 * distinto a la misma etapa, sus eventos dejarían de ser comparables entre sí.
 */
exports.STAGE_LABELS_BY_KEY = {
    new: 'Nuevo',
    contacted: 'Contactado',
    quote_sent: 'Calificado',
    meeting_scheduled: 'Visita agendada',
    negotiation: 'Negociación',
    won: 'Venta',
    lost: 'Descartado',
    reserved: 'Reservado',
    attended: 'Asistió',
    no_show: 'No asistió',
};
/** Prioridad manual. No se deriva del puntaje automático. */
exports.LEAD_TRAFFIC_LIGHTS = ['green', 'yellow', 'red'];
/**
 * Orígenes por los que puede entrar un lead.
 *
 * La clave y el rótulo se declaran por separado a propósito. La clave es lo que se guarda en
 * `leads.source` y lo que ya usan las integraciones —`meta_lead_ads` lo escribe el webhook de
 * Meta—, así que renombrarla dejaría los leads antiguos en un origen que ningún informe
 * reconoce. El rótulo es lo único que se lee en pantalla y puede cambiar sin tocar la base.
 *
 * La lista es cerrada para que agrupar por origen signifique algo: con texto libre, «Meta Ads»,
 * «meta ads» y «Meta» eran tres orígenes distintos en el mismo panel.
 */
exports.LEAD_SOURCES = [
    { value: 'meta_lead_ads', label: 'Meta Ads' },
    { value: 'formulario_web', label: 'Formulario web' },
    { value: 'portal_inmobiliario', label: 'Portal inmobiliario' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'telefono', label: 'Teléfono' },
    { value: 'presencial', label: 'Presencial' },
    { value: 'referido', label: 'Referido' },
    { value: 'otro', label: 'Otro' },
];
/**
 * Cómo se lee un origen en pantalla.
 *
 * Un valor fuera del catálogo se devuelve tal cual y no se traduce a «Otro»: los leads que ya
 * existen traen orígenes que ningún catálogo declara, y mostrarlos todos como «Otro» borraría
 * la única pista de por dónde entraron.
 */
function etiquetaDeFuente(value) {
    if (!value)
        return '';
    return exports.LEAD_SOURCES.find((fuente) => fuente.value === value)?.label ?? value;
}
/** Catálogo de descarte usado por el flujo comercial de referencia MMT. */
exports.LEAD_DISCARD_REASONS = [
    'Precio fuera de presupuesto',
    'Sin financiamiento / no calificó crédito',
    'Compró en otro proyecto',
    'Nunca respondió',
    'Datos de contacto erróneos',
    'Ubicación no le acomoda',
    'Solo consultaba (sin intención)',
    'No es el perfil buscado',
    'Otro',
];
/**
 * Por qué se perdió un negocio de la agencia.
 *
 * Distinto del catálogo de descarte de un lead: aquél es del embudo inmobiliario del cliente
 * —crédito, proyecto, ubicación— y éste de los tratos que Espartanos cierra o pierde.
 *
 * Vive acá porque había uno por pantalla y **no coincidían**: el tablero guardaba
 * `sin_presupuesto` y la tabla «Sin presupuesto». Los mismos datos escritos desde dos sitios no
 * se agrupaban en el mismo informe, y la pregunta «¿por qué perdemos?» no tenía respuesta.
 */
exports.OPPORTUNITY_LOSS_REASONS = [
    'Precio',
    'Sin presupuesto',
    'No respondió',
    'Eligió competencia',
    'Fuera de alcance',
    'Prioridad postergada',
    'Mal momento',
    'Servicio no disponible',
    'Duplicado',
    'Otro',
];
//# sourceMappingURL=lead.js.map