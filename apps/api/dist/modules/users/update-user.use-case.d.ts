import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Client } from '../clients/client.entity';
import { UserRole } from '../organizations/user-role.enum';
interface UpdateUserInput {
    id: string;
    organizationId: string;
    actorId: string;
    actorRole: UserRole;
    name?: string;
    email?: string;
    phone?: string;
    role?: UserRole;
    clientId?: string | null;
    isActive?: boolean;
    password?: string;
    workMode?: 'presential' | 'hybrid' | 'remote';
    weeklyCapacityUd?: number;
}
export declare class UpdateUserUseCase {
    private readonly usersRepo;
    private readonly clientsRepo;
    constructor(usersRepo: Repository<User>, clientsRepo: Repository<Client>);
    execute(data: UpdateUserInput): Promise<User>;
}
export {};
