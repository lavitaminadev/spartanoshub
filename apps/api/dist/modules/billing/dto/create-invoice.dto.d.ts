export declare class CreateInvoiceDto {
    clientId: string;
    number: string;
    issuedAt: string;
    dueAt: string;
    subtotal: number;
    tax?: number;
    total: number;
    currency?: string;
    notes?: string;
}
