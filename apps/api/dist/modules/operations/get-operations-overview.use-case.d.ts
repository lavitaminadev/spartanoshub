import { DataSource } from 'typeorm';
export declare class GetOperationsOverviewUseCase {
    private dataSource;
    constructor(dataSource: DataSource);
    execute(organizationId: string): Promise<{
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
