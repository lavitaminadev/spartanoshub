import { Repository } from 'typeorm';
import { Organization } from './organization.entity';
interface CreateOrganizationInput {
    name: string;
    code: string;
    currency?: string;
}
export declare class CreateOrganizationUseCase {
    private readonly repo;
    constructor(repo: Repository<Organization>);
    execute(data: CreateOrganizationInput): Promise<Organization>;
    executeUpdate(id: string, data: {
        name?: string;
        currency?: string;
    }): Promise<Organization | null>;
}
export {};
