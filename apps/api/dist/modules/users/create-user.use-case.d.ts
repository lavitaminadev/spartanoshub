import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from '../organizations/user-role.enum';
import { Client } from '../clients/client.entity';
interface CreateUserInput {
    email: string;
    password: string;
    name: string;
    organizationId: string;
    role?: UserRole;
    phone?: string;
    clientId?: string;
    workMode?: 'presential' | 'hybrid' | 'remote';
    weeklyCapacityUd?: number;
    actorRole: UserRole;
}
export declare class CreateUserUseCase {
    private readonly repo;
    private readonly clientsRepo;
    constructor(repo: Repository<User>, clientsRepo: Repository<Client>);
    execute(data: CreateUserInput): Promise<User>;
    private resolveClientId;
}
export {};
