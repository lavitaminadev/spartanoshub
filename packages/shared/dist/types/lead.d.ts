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
export declare const LEAD_FIT_STATUSES: readonly ["qualified", "review", "discarded"];
export type LeadFitStatus = (typeof LEAD_FIT_STATUSES)[number];
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