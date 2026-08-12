import { Client } from '../clients/client.entity';
export declare class UDBudget {
    id: string;
    clientId: string;
    client: Client;
    year: number;
    month: number;
    contracted: number;
    reserved: number;
    consumed: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}
