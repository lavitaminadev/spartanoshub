import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from '../organizations/user-role.enum';
import { EmailService } from '../../core/notifications/email.service';
export declare class ResetUserPasswordUseCase {
    private readonly users;
    private readonly email;
    constructor(users: Repository<User>, email: EmailService);
    execute(params: {
        id: string;
        organizationId: string;
        actorRole: UserRole;
        sendEmail?: boolean;
    }): Promise<{
        userId: string;
        temporaryPassword: string;
        emailSent: boolean;
        mustChangePassword: boolean;
    }>;
}
