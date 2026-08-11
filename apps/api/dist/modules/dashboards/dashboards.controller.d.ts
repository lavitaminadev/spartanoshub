import { DashboardsService } from './dashboards.service';
import type { AuthenticatedRequest } from '@shared/types/request';
export declare class DashboardsController {
    private service;
    constructor(service: DashboardsService);
    overview(req: AuthenticatedRequest): Promise<{
        clients: any;
        contracts: any;
        pieces: any;
        users: any;
    }>;
    production(req: AuthenticatedRequest): Promise<{
        pieces: any;
        briefs: any;
    }>;
    financial(req: AuthenticatedRequest): Promise<{
        ud: any;
        contracts: any;
    }>;
}
