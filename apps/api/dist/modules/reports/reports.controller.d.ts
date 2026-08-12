import { DataSource } from 'typeorm';
import type { AuthenticatedRequest } from '@shared/types/request';
import { VitaminaPulseService } from './vitamina-pulse.service';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { MonthlyReportsService } from './monthly-reports.service';
import { GenerateMonthlyReportDto, UpdateMonthlyReportDto } from './dto/monthly-report.dto';
export declare class ReportingController {
    private dataSource;
    private readonly pulseService;
    private readonly accountAccess;
    private readonly monthlyReports;
    constructor(dataSource: DataSource, pulseService: VitaminaPulseService, accountAccess: AccountAccessService, monthlyReports: MonthlyReportsService);
    private resolveClientScope;
    pulse(req: AuthenticatedRequest): Promise<{
        score: number | null;
        coverage: number;
        status: "blocked" | "healthy" | "attention" | "no_data";
        stage: string;
        generatedAt: string;
        dimensions: {
            key: string;
            label: string;
            score: number | null;
            weight: number;
            evidence: string;
            status: "healthy" | "attention" | "blocked" | "no_data";
        }[];
        actions: {
            id: string;
            title: string;
            detail: string;
            priority: "high" | "medium" | "low";
            owner: "team" | "client";
            route: string;
        }[];
        commitments: {
            team: number;
            client: number;
        };
        impact: {
            type: string;
            title: string;
            detail: string;
            happenedAt: string | Date;
        }[];
    }>;
    dashboard(req: AuthenticatedRequest): Promise<{
        activeClients: number;
        pendingPieces: number;
        teamXp: number;
        monthUd: number;
        ud: {
            contracted: number;
            consumed: number;
            reserved: number;
        };
        pieces: {
            status: string;
            count: number;
        }[];
    }>;
    reports(req: AuthenticatedRequest): Promise<{
        totalRevenue: number;
        activeProjects: number;
        avgUdPerClient: number;
        monthlyData: {
            month: string;
            revenue: number;
            ud: number;
        }[];
        topClients: {
            name: string;
            revenue: number;
        }[];
    }>;
    kpi(req: AuthenticatedRequest): Promise<{
        revenueYtd: number;
        activeClients: number;
        contractedUd: number;
        retentionPct: number;
        revenueTarget?: undefined;
        clientTarget?: undefined;
        udSold?: undefined;
        udTarget?: undefined;
        teamUtilization?: undefined;
        utilizationTarget?: undefined;
        clientRetention?: undefined;
        nps?: undefined;
        growthRate?: undefined;
    } | {
        revenueYtd: number;
        revenueTarget: null;
        activeClients: number;
        clientTarget: null;
        udSold: number;
        udTarget: null;
        teamUtilization: null;
        utilizationTarget: null;
        clientRetention: number;
        nps: null;
        growthRate: null;
        contractedUd?: undefined;
        retentionPct?: undefined;
    }>;
    performance(req: AuthenticatedRequest): Promise<{
        periodDays: number;
        providers: {
            provider: string;
            spend: number;
            impressions: number;
            reach: number;
            clicks: number;
            leads: number;
            conversions: number;
            lastDataAt: string | undefined;
        }[];
        totals: {
            spend: number;
            impressions: number;
            reach: number;
            clicks: number;
            leads: number;
            conversions: number;
        };
        derived: {
            cpc: number | null;
            cpl: number | null;
            ctr: number | null;
            conversionRate: number | null;
        };
        hasData: boolean;
    }>;
    listMonthlyReports(req: AuthenticatedRequest, year?: string, month?: string, requestedClientId?: string): Promise<{
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
    generateMonthlyReport(req: AuthenticatedRequest, dto: GenerateMonthlyReportDto): Promise<import("./monthly-report.entity").MonthlyReport>;
    updateMonthlyReport(req: AuthenticatedRequest, id: string, dto: UpdateMonthlyReportDto): Promise<import("./monthly-report.entity").MonthlyReport>;
    publishMonthlyReport(req: AuthenticatedRequest, id: string): Promise<import("./monthly-report.entity").MonthlyReport>;
    unpublishMonthlyReport(req: AuthenticatedRequest, id: string): Promise<import("./monthly-report.entity").MonthlyReport>;
}
