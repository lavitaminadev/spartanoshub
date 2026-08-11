import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { AuthUser } from '../../shared/types/request';
import { UserRole } from '../../modules/organizations/user-role.enum';
import type { Request, Response } from 'express';
import { ChangePasswordDto, CompletePasswordResetDto, RequestPasswordResetDto } from './dto/password-reset.dto';
import { AcceptTermsDto, CompleteOnboardingDto } from './dto/onboarding.dto';
import { ReauthenticateDto } from './dto/reauthenticate.dto';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    register(dto: RegisterDto, response: Response): Promise<{
        accessToken: string;
        user: import("@vitahub/shared").UserDto;
    }>;
    login(dto: LoginDto, request: Request, ip: string, response: Response): Promise<{
        accessToken: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: UserRole;
            avatarUrl: string | null | undefined;
            clientId: string | undefined;
            organizationId: string;
            mustChangePassword: boolean;
        };
    }>;
    refresh(dto: RefreshDto, request: Request, response: Response): Promise<{
        accessToken: string;
    }>;
    browserSession(dto: RefreshDto, request: Request, response: Response): Promise<{
        authenticated: false;
        accessToken?: undefined;
    } | {
        authenticated: true;
        accessToken: string;
    }>;
    logout(user: AuthUser, response: Response): Promise<void>;
    listSessions(user: AuthUser): Promise<import("./sessions.service").SessionSummary[]>;
    closeOtherSessions(user: AuthUser): Promise<{
        closed: number;
    }>;
    closeSession(user: AuthUser, id: string): Promise<void>;
    reauthenticate(user: AuthUser, dto: ReauthenticateDto): Promise<{
        confirmed: true;
        validUntil: Date;
    }>;
    me(user: AuthUser): Promise<(import("../../modules/users/user.entity").User & {
        features: import("../../modules/organizations/organization-features").OrganizationFeatures;
        mustAcceptTerms: boolean;
    }) | null>;
    updateProfile(user: AuthUser, dto: UpdateProfileDto): Promise<import("../../modules/users/user.entity").User | null>;
    requestPasswordReset(dto: RequestPasswordResetDto): Promise<{
        accepted: true;
    }>;
    completePasswordReset(dto: CompletePasswordResetDto): Promise<{
        changed: true;
    }>;
    changePassword(user: AuthUser, dto: ChangePasswordDto, response: Response): Promise<{
        changed: true;
    }>;
    completeOnboarding(user: AuthUser, dto: CompleteOnboardingDto, ipAddress: string, response: Response): Promise<{
        completed: true;
    }>;
    acceptTerms(user: AuthUser, dto: AcceptTermsDto, ipAddress: string): Promise<{
        accepted: true;
    }>;
}
