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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecentAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const requires_recent_auth_decorator_1 = require("./requires-recent-auth.decorator");
const sessions_service_1 = require("./sessions.service");
let RecentAuthGuard = class RecentAuthGuard {
    constructor(reflector, sessions) {
        this.reflector = reflector;
        this.sessions = sessions;
    }
    async canActivate(context) {
        const reason = this.reflector.getAllAndOverride(requires_recent_auth_decorator_1.REQUIRES_RECENT_AUTH_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!reason)
            return true;
        const request = context.switchToHttp().getRequest();
        const sessionId = request.user?.sessionId;
        if (!sessionId || !(await this.sessions.hasRecentAuth(sessionId))) {
            throw new common_1.ForbiddenException({
                message: `Confirma tu contraseña para ${reason}`,
                reauthRequired: true,
                windowMinutes: sessions_service_1.REAUTH_WINDOW_MINUTES,
            });
        }
        return true;
    }
};
exports.RecentAuthGuard = RecentAuthGuard;
exports.RecentAuthGuard = RecentAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        sessions_service_1.SessionsService])
], RecentAuthGuard);
