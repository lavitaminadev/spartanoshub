import { GetOperationsOverviewUseCase } from './get-operations-overview.use-case';
import type { AuthenticatedRequest } from '@shared/types/request';
export declare class OperationsController {
    private overview;
    constructor(overview: GetOperationsOverviewUseCase);
    getOverview(req: AuthenticatedRequest): Promise<{
        pods: {
            capacity: number;
            memberCount: number;
            clientCount: number;
            currentLoad: number;
        }[];
        team: {
            currentPieces: number;
            currentLoad: number;
            capacity: number;
            id: string;
            name: string;
            role: string;
        }[];
        totalCapacity: number;
        usedCapacity: number;
    }>;
}
