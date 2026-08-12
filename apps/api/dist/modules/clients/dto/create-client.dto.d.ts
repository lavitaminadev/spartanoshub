export declare class ClientCapabilitiesDto {
    reservations?: boolean;
    crm?: boolean;
    metaConversions?: boolean;
}
export declare class CreateClientDto {
    name: string;
    legalName?: string;
    industry?: string;
    communityManagerId?: string;
    leadId?: string;
    retainerAmount?: number;
    currency?: string;
    defaultUdBudget?: number;
    dailyReservationCap?: number;
    capabilities?: ClientCapabilitiesDto;
}
