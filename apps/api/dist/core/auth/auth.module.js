"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const typeorm_1 = require("@nestjs/typeorm");
const core_1 = require("@nestjs/core");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const jwt_strategy_1 = require("./jwt.strategy");
const auth_guard_1 = require("./auth.guard");
const organization_context_guard_1 = require("../organization/organization-context.guard");
const roles_guard_1 = require("../authorization/roles.guard");
const feature_guard_1 = require("../authorization/feature.guard");
const consent_entity_1 = require("../data-protection/consent.entity");
const parameters_module_1 = require("../parameters/parameters.module");
const user_entity_1 = require("../../modules/users/user.entity");
const organization_entity_1 = require("../../modules/organizations/organization.entity");
const config_1 = require("../../config");
const password_reset_token_entity_1 = require("./password-reset-token.entity");
const user_session_entity_1 = require("./user-session.entity");
const sessions_service_1 = require("./sessions.service");
const recent_auth_guard_1 = require("./recent-auth.guard");
const email_module_1 = require("../notifications/email.module");
const ACCESS_TOKEN_EXPIRES_IN = config_1.config.jwt.expiresIn;
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, organization_entity_1.Organization, password_reset_token_entity_1.PasswordResetToken, consent_entity_1.DataConsent, user_session_entity_1.UserSession]),
            parameters_module_1.ParametersModule,
            email_module_1.EmailModule,
            passport_1.PassportModule.register({ defaultStrategy: 'jwt' }),
            jwt_1.JwtModule.register({ secret: config_1.config.jwt.secret, signOptions: { expiresIn: ACCESS_TOKEN_EXPIRES_IN } }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            auth_service_1.AuthService,
            sessions_service_1.SessionsService,
            jwt_strategy_1.JwtStrategy,
            { provide: core_1.APP_GUARD, useClass: auth_guard_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: organization_context_guard_1.OrganizationContextGuard },
            { provide: core_1.APP_GUARD, useClass: roles_guard_1.RolesGuard },
            feature_guard_1.FeatureGuard,
            { provide: core_1.APP_GUARD, useExisting: feature_guard_1.FeatureGuard },
            { provide: core_1.APP_GUARD, useClass: recent_auth_guard_1.RecentAuthGuard },
        ],
        exports: [auth_service_1.AuthService, sessions_service_1.SessionsService, jwt_1.JwtModule, feature_guard_1.FeatureGuard],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map