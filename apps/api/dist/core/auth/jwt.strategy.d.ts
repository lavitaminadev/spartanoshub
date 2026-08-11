import { Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/user.entity';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { SessionsService } from './sessions.service';
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly userRepo;
    private readonly sessions;
    constructor(userRepo: Repository<User>, sessions: SessionsService);
    validate(payload: {
        sub: string;
        email: string;
        organizationId: string;
        role: UserRole;
        clientId?: string;
        sid?: string;
        iat?: number;
    }): Promise<{
        id: string;
        email: string;
        role: UserRole;
        organizationId: string;
        clientId: string | undefined;
        name: string;
        sessionId: string | undefined;
        tenantId: string;
    }>;
}
export {};
