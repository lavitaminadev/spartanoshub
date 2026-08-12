import { Repository } from 'typeorm';
import { Organization } from './organization.entity';
export declare class ListOrganizationsUseCase {
    private readonly repo;
    constructor(repo: Repository<Organization>);
    execute(organizationId: string): Promise<Organization[]>;
}
