export declare class GoogleConversionOutbox {
    id: string;
    organizationId: string;
    eventId: string;
    customerId: string;
    conversionAction: string;
    conversionData: Record<string, any>;
    status: string;
    attempts: number;
    nextAttemptAt?: Date;
    lastError?: string;
    processedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
