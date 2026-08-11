export declare class MetaLeadWebhookEvent {
    id: string;
    organizationId?: string;
    pageId: string;
    leadgenId: string;
    formId?: string;
    processingStatus: string;
    errorMessage?: string;
    rawPayload: Record<string, any>;
    normalizedPayload?: Record<string, any>;
    processedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
