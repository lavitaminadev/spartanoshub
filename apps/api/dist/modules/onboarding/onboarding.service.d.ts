import { Repository } from 'typeorm';
import { Onboarding } from './onboarding.entity';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { WorkflowsService } from '../workflows/workflows.service';
export declare class OnboardingService {
    private readonly repo;
    private readonly clients;
    private readonly users;
    private readonly workflows;
    constructor(repo: Repository<Onboarding>, clients: Repository<Client>, users: Repository<User>, workflows: WorkflowsService);
    create(dto: CreateOnboardingDto, organizationId: string): Promise<Onboarding>;
    findAll(organizationId: string, limit?: number, offset?: number): Promise<{
        data: Onboarding[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOne(id: string, organizationId: string): Promise<Onboarding>;
    update(id: string, dto: UpdateOnboardingDto, organizationId: string): Promise<Onboarding>;
    remove(id: string, organizationId: string): Promise<Onboarding>;
    createStandardChecklist(clientId: string, organizationId: string): Promise<Onboarding[]>;
    private validateReferences;
}
