/**
 * @fileoverview Lead domain types.
 */
/**
 * Etapas del pipeline comercial. El equipo las mueve a mano y son ordenadas:
 * el orden de este arreglo es el orden de las columnas del tablero.
 */
export declare const LEAD_PIPELINE_STAGES: readonly ["new", "contacted", "quote_sent", "meeting_scheduled", "visited", "negotiation"];
/**
 * Resultados del ciclo de reserva. Los escribe el sistema, no el equipo:
 * `reserved` al crearse la reserva y `attended` / `no_show` al registrar la
 * asistencia. No son etapas del pipeline y no se arrastran.
 */
export declare const LEAD_RESERVATION_OUTCOMES: readonly ["reserved", "attended", "no_show"];
/**
 * Cierres del pipeline comercial.
 */
export declare const LEAD_CLOSING_STAGES: readonly ["won", "lost"];
/**
 * Universo completo de estados aceptados. Es la unica fuente de verdad: el enum
 * del backend y las columnas del tablero derivan de aca para que no se
 * desincronicen.
 */
export declare const LEAD_STATUSES: readonly ["new", "contacted", "quote_sent", "meeting_scheduled", "visited", "negotiation", "reserved", "attended", "no_show", "won", "lost"];
/**
 * Que estados admite cada embudo, en el orden en que se recorren.
 *
 * **Es la fuente unica.** El enum de la API, el reparto por dominio, las columnas del tablero y
 * la paleta de estados derivan de aca. Estuvieron declarados por separado en cinco sitios, y esa
 * duplicacion costo dos fallos silenciosos: faltaba 'visited' en el embudo comercial y 'lost' en
 * el de campana, asi que los leads en esos estados no tenian columna donde dibujarse. No fallaba
 * nada; simplemente desaparecian de la pantalla.
 *
 * Los dos embudos comparten 'new' y 'lost' a proposito: todo lead nace nuevo, y tanto una venta
 * que no se gano como una visita que no ocurrio se cierran igual.
 */
export declare const LEAD_STATUSES_BY_DOMAIN: {
    readonly commercial: readonly ["new", "contacted", "quote_sent", "meeting_scheduled", "visited", "negotiation", "won", "lost"];
    readonly audience: readonly ["new", "reserved", "attended", "no_show", "lost"];
};
/** Embudo al que pertenece un lead. */
export type LeadDomain = keyof typeof LEAD_STATUSES_BY_DOMAIN;
/**
 * Lead funnel status.
 */
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export declare const LEAD_FIT_STATUSES: readonly ["qualified", "review", "unqualified"];
export type LeadFitStatus = (typeof LEAD_FIT_STATUSES)[number];
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
export declare const STAGE_LABELS_BY_KEY: Record<string, string>;
/** Prioridad manual. No se deriva del puntaje automático. */
export declare const LEAD_TRAFFIC_LIGHTS: readonly ["green", "yellow", "red"];
export type LeadTrafficLight = (typeof LEAD_TRAFFIC_LIGHTS)[number];
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
export declare const LEAD_SOURCES: readonly [{
    readonly value: "meta_lead_ads";
    readonly label: "Meta Ads";
}, {
    readonly value: "formulario_web";
    readonly label: "Formulario web";
}, {
    readonly value: "portal_inmobiliario";
    readonly label: "Portal inmobiliario";
}, {
    readonly value: "whatsapp";
    readonly label: "WhatsApp";
}, {
    readonly value: "telefono";
    readonly label: "Teléfono";
}, {
    readonly value: "presencial";
    readonly label: "Presencial";
}, {
    readonly value: "referido";
    readonly label: "Referido";
}, {
    readonly value: "otro";
    readonly label: "Otro";
}];
export type LeadSource = (typeof LEAD_SOURCES)[number]['value'];
/**
 * Cómo se lee un origen en pantalla.
 *
 * Un valor fuera del catálogo se devuelve tal cual y no se traduce a «Otro»: los leads que ya
 * existen traen orígenes que ningún catálogo declara, y mostrarlos todos como «Otro» borraría
 * la única pista de por dónde entraron.
 */
export declare function etiquetaDeFuente(value?: string | null): string;
/** Catálogo de descarte usado por el flujo comercial de referencia MMT. */
export declare const LEAD_DISCARD_REASONS: readonly ["Precio fuera de presupuesto", "Sin financiamiento / no calificó crédito", "Compró en otro proyecto", "Nunca respondió", "Datos de contacto erróneos", "Ubicación no le acomoda", "Solo consultaba (sin intención)", "No es el perfil buscado", "Otro"];
/**
 * Lead response returned by CRM endpoints.
 */
export interface LeadResponse {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    clientId?: string;
    source?: string;
    sourceDetail?: string;
    externalLeadId?: string;
    externalFormId?: string;
    externalCampaignId?: string;
    campaignName?: string;
    pageId?: string;
    status: LeadStatus;
    fitStatus: LeadFitStatus;
    qualityScore: number;
    trafficLight?: LeadTrafficLight;
    discardReason?: string;
    assignedTo?: string;
    notes?: string;
    consentCapturedAt?: Date;
    retentionReviewAt?: Date;
    metadata?: Record<string, unknown>;
    convertedAt?: Date;
    convertedToClientId?: string;
    createdAt: Date;
}
/**
 * Payload to create a new lead.
 */
export interface CreateLeadRequest {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    source?: string;
}
//# sourceMappingURL=lead.d.ts.map