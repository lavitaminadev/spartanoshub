import { Repository } from 'typeorm';
import { ContentGrid } from './content-grid.entity';
import { Client } from '../clients/client.entity';
export declare class CreateContentGridUseCase {
    private repo;
    private clients;
    constructor(repo: Repository<ContentGrid>, clients: Repository<Client>);
    execute(data: {
        organizationId: string;
        clientId: string;
        title: string;
        weekStart: Date;
        weekEnd: Date;
        notes?: string;
    }): Promise<ContentGrid>;
}
