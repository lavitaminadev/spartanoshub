import { UserRole } from '../../organizations/user-role.enum';
export declare class UpdateUserDto {
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
