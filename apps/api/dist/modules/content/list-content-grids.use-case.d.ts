import { Repository } from 'typeorm';
import { ContentGrid } from './content-grid.entity';
export declare class ListContentGridsUseCase {
    private repo;
    constructor(repo: Repository<ContentGrid>);
    execute(organizationId: string, clientId?: string, month?: string, clientVisibleOnly?: boolean, clientIds?: string[]): Promise<ContentGrid[]>;
}
