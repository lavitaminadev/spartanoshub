import { Repository, DataSource } from 'typeorm';
import { Client } from './client.entity';
export interface ClientOverviewStats {
    client: Client;
    stats: {
        pendingPieces: number;
        contentGrids: number;
        meetings: number;
        upcomingMeetings: number;
        documents: number;
        reservationForms: number;
        publishedForms: number;
        contracts: number;
        activeContracts: number;
        briefs: number;
        approvedBriefs: number;
    };
    ud: {
        contracted: number;
        reserved: number;
        consumed: number;
    };
    pieceStatuses: Array<{
        status: string;
        total: number;
    }>;
    recentPieces: any[];
    recentMeetings: any[];
}
export declare class ClientOverviewService {
    private readonly clients;
    private readonly dataSource;
    constructor(clients: Repository<Client>, dataSource: DataSource);
    getOverview(clientId: string, organizationId: string): Promise<ClientOverviewStats>;
}
