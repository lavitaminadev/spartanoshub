export declare class IntegrationMetric {
    id: string;
    organizationId: string;
    clientId: string;
    provider: string;
    externalAccountId: string;
    metricDate: Date;
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    conversions: number;
    leads: number;
    breakdown?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
