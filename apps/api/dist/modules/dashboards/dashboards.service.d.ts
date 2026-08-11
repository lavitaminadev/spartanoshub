import { DataSource } from 'typeorm';
export declare class DashboardsService {
    private dataSource;
    constructor(dataSource: DataSource);
    getOverview(organizationId: string): Promise<{
        clients: any;
        contracts: any;
        pieces: any;
        users: any;
    }>;
    getProduction(organizationId: string): Promise<{
        pieces: any;
        briefs: any;
    }>;
    getFinancial(organizationId: string): Promise<{
        ud: any;
        contracts: any;
    }>;
}
