import { CreateUserUseCase } from './create-user.use-case';
import { ListUsersUseCase } from './list-users.use-case';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { UpdateUserUseCase } from './update-user.use-case';
import { ResetUserPasswordUseCase } from './reset-user-password.use-case';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
export declare class UsersController {
    private readonly createUser;
    private readonly listUsers;
    private readonly updateUser;
    private readonly resetUserPassword;
    constructor(createUser: CreateUserUseCase, listUsers: ListUsersUseCase, updateUser: UpdateUserUseCase, resetUserPassword: ResetUserPasswordUseCase);
    create(dto: CreateUserDto, req: AuthenticatedRequest): Promise<import("./user.entity").User>;
    list(role: UserRole | undefined, clientId: string | undefined, q: string | undefined, isActive: string | undefined, req: AuthenticatedRequest): Promise<import("./user.entity").User[]>;
    update(id: string, dto: UpdateUserDto, req: AuthenticatedRequest): Promise<import("./user.entity").User>;
    resetPassword(id: string, dto: ResetUserPasswordDto, req: AuthenticatedRequest): Promise<{
        userId: string;
        temporaryPassword: string;
        emailSent: boolean;
        mustChangePassword: boolean;
    }>;
}
