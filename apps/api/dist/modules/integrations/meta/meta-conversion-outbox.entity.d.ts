export declare class MetaConversionOutbox {
    id: string;
    organizationId: string;
    eventId: string;
    pixelId: string;
    eventData: Record<string, any>;
    status: string;
    attempts: number;
    nextAttemptAt?: Date;
    lastError?: string;
    processedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
