export declare class GenerateMonthlyReportDto {
    clientId: string;
    year: number;
    month: number;
}
export declare class UpdateMonthlyReportDto {
    title?: string;
    executiveSummary?: string;
    insights?: string[];
    recommendations?: string;
    salesGenerated?: number;
}
