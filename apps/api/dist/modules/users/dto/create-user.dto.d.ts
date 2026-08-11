import { UserRole } from '../../organizations/user-role.enum';
export declare class CreateUserDto {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: UserRole;
    clientId?: string;
    workMode?: 'presential' | 'hybrid' | 'remote';
    weeklyCapacityUd?: number;
}
