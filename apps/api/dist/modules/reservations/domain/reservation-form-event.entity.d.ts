export declare class ReservationFormEvent {
    id: string;
    organizationId: string;
    clientId: string;
    formId: string;
    type: string;
    sessionId?: string;
    utmSource?: string;
    utmCampaign?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}
