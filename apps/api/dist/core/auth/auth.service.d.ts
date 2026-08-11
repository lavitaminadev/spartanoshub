import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import type { AuthResponse } from '@vitahub/shared';
import { User } from '../../modules/users/user.entity';
import { Organization } from '../../modules/organizations/organization.entity';
import { OrganizationFeatures } from '../../modules/organizations/organization-features';
import { PasswordResetToken } from './password-reset-token.entity';
import { EmailService } from '../notifications/email.service';
import { CompleteOnboardingDto } from './dto/onboarding.dto';
import { ParameterResolver } from '../parameters/parameter-resolver.service';
import { SessionsService, type SessionSummary } from './sessions.service';
export interface SessionContext {
    userAgent?: string;
    ipAddress?: string;
}
export declare class AuthService {
    private readonly userRepo;
    private readonly orgRepo;
    private readonly resetRepo;
    private readonly emailService;
    private readonly jwtService;
    private readonly parameters;
    private readonly sessions;
    private readonly logger;
    constructor(userRepo: Repository<User>, orgRepo: Repository<Organization>, resetRepo: Repository<PasswordResetToken>, emailService: EmailService, jwtService: JwtService, parameters: ParameterResolver, sessions: SessionsService);
    validateUser(email: string, password: string): Promise<User>;
    private registerFailedAttempt;
    login(user: User, context?: SessionContext): Promise<AuthResponse>;
    refreshToken(token: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    private issueForNewSession;
    register(data: {
        email: string;
        password: string;
        name: string;
    }): Promise<AuthResponse>;
    logout(userId: string, sessionId?: string): Promise<void>;
    listSessions(userId: string, currentSessionId?: string): Promise<SessionSummary[]>;
    closeSession(userId: string, sessionId: string): Promise<void>;
    closeOtherSessions(userId: string, currentSessionId?: string): Promise<number>;
    reauthenticate(userId: string, sessionId: string | undefined, password: string): Promise<{
        confirmed: true;
        validUntil: Date;
    }>;
    me(userId: string): Promise<(User & {
        features: OrganizationFeatures;
        mustAcceptTerms: boolean;
    }) | null>;
    acceptCurrentTerms(userId: string, acceptedConsents: string[], ipAddress?: string): Promise<{
        accepted: true;
    }>;
    private termsPending;
    updateProfile(userId: string, data: {
        name?: string;
        email?: string;
    }): Promise<User | null>;
    requestPasswordReset(rawEmail: string): Promise<{
        accepted: true;
    }>;
    completePasswordReset(token: string, password: string): Promise<{
        changed: true;
    }>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        changed: true;
    }>;
    completeOnboarding(userId: string, sessionId: string | undefined, dto: CompleteOnboardingDto, ipAddress?: string): Promise<{
        completed: true;
    }>;
}
