export declare class ChargeNote {
    id: string;
    organizationId: string;
    clientId: string;
    pieceId: string;
    correctionId: string;
    status: string;
    amount?: number;
    currency: string;
    reason: string;
    invoiceId?: string;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
