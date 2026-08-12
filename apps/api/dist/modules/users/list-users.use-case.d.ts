import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from '../organizations/user-role.enum';
interface ListUsersFilters {
    organizationId: string;
    role?: UserRole;
    clientId?: string;
    isActive?: boolean;
    q?: string;
}
export declare class ListUsersUseCase {
    private readonly repo;
    constructor(repo: Repository<User>);
    execute(filters: ListUsersFilters): Promise<User[]>;
}
export {};
