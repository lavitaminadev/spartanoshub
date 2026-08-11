import { DataSource, Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { MonthlyReport } from './monthly-report.entity';
import { GenerateMonthlyReportDto, UpdateMonthlyReportDto } from './dto/monthly-report.dto';
export declare class MonthlyReportsService {
    private readonly reports;
    private readonly clients;
    private readonly dataSource;
    constructor(reports: Repository<MonthlyReport>, clients: Repository<Client>, dataSource: DataSource);
    list(organizationId: string, options: {
        clientId?: string;
        clientIds?: string[];
        clientView?: boolean;
        year?: number;
        month?: number;
    }): Promise<{
        clientName: string;
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
    }[]>;
    generate(organizationId: string, userId: string, dto: GenerateMonthlyReportDto): Promise<MonthlyReport>;
    update(id: string, organizationId: string, dto: UpdateMonthlyReportDto): Promise<MonthlyReport>;
    setPublished(id: string, organizationId: string, userId: string, published: boolean): Promise<MonthlyReport>;
    private find;
}
