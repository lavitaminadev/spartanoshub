import { Client } from '../clients/client.entity';
export declare class AccountCycle {
    id: string;
    organizationId: string;
    clientId: string;
    client: Client;
    year: number;
    month: number;
    status: string;
    gridStatus: string;
    productionStatus: string;
    weeklyMeetingsDue: number;
    weeklyMeetingsCompleted: number;
    strategyMeetingStatus: string;
    reportStatus: string;
    startedAt: Date;
    endsAt: Date;
    closedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
