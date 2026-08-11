"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../../modules/users/user.entity");
const config_1 = require("../../config");
const sessions_service_1 = require("./sessions.service");
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    constructor(userRepo, sessions) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: config_1.config.jwt.secret,
        });
        this.userRepo = userRepo;
        this.sessions = sessions;
    }
    async validate(payload) {
        const user = await this.userRepo.findOne({ where: { id: payload.sub, isActive: true } });
        if (!user)
            throw new common_1.UnauthorizedException();
        if (user.passwordChangedAt && payload.iat && payload.iat * 1000 < user.passwordChangedAt.getTime()) {
            throw new common_1.UnauthorizedException('Session invalidated by a password change');
        }
        if (payload.sid && !(await this.sessions.isLive(payload.sid))) {
            throw new common_1.UnauthorizedException('La sesión fue cerrada');
        }
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
            clientId: user.clientId,
            name: user.name,
            sessionId: payload.sid,
            tenantId: user.organizationId,
        };
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        sessions_service_1.SessionsService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map