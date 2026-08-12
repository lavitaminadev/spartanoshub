export declare class QuoteItemDto {
    serviceId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
}
export declare class CreateQuoteDto {
    clientId?: string;
    leadId?: string;
    title: string;
    currency?: string;
    validUntil?: string;
    notes?: string;
    items: QuoteItemDto[];
}
export declare class UpdateQuoteDto extends CreateQuoteDto {
}
