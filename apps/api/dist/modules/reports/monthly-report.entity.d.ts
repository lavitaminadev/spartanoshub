export declare class MonthlyReport {
    id: string;
    organizationId: string;
    clientId: string;
    year: number;
    month: number;
    title: string;
    status: string;
    executiveSummary?: string;
    metrics: Record<string, number>;
    insights?: string[];
    recommendations?: string;
    salesGenerated: number;
    adSpend: number;
    leads: number;
    bookings: number;
    conversions: number;
    createdBy: string;
    publishedBy?: string;
    publishedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
