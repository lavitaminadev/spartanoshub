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
exports.GoogleController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const google_oauth_service_1 = require("./google-oauth.service");
const roles_decorator_1 = require("../../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../../organizations/user-role.enum");
const google_oauth_callback_dto_1 = require("./dto/google-oauth-callback.dto");
const oauth_state_1 = require("../../../shared/security/oauth-state");
const integration_response_1 = require("../integration-response");
const google_data_service_1 = require("./google-data.service");
const throttler_1 = require("@nestjs/throttler");
const register_analytics_property_dto_1 = require("./dto/register-analytics-property.dto");
const oauth_redirect_1 = require("../../../shared/security/oauth-redirect");
const module_scope_decorator_1 = require("../../../core/authorization/module-scope.decorator");
let GoogleController = class GoogleController {
    constructor(oauth, data) {
        this.oauth = oauth;
        this.data = data;
    }
    getAuthUrl(req, redirectUri) {
        const uri = (0, oauth_redirect_1.resolveOAuthRedirect)('google', redirectUri);
        const state = (0, oauth_state_1.createOAuthState)('google', req.organizationId, uri);
        return { url: this.oauth.getAuthorizationUrl(uri, state) };
    }
    getStatus() {
        return {
            configured: this.oauth.isConfigured(),
            clientId: this.oauth.getClientId() || null,
            adsConfigured: Boolean(process.env.GOOGLE_DEVELOPER_TOKEN),
            adsApiVersion: process.env.GOOGLE_ADS_API_VERSION?.trim() || 'v24',
        };
    }
    handleCallback(body, req) {
        const redirectUri = (0, oauth_redirect_1.resolveOAuthRedirect)('google', body.redirectUri);
        (0, oauth_state_1.verifyOAuthState)(body.state, { provider: 'google', organizationId: req.organizationId, redirectUri });
        return this.oauth.connectWithCode(req.organizationId, body.code, redirectUri).then(integration_response_1.toIntegrationResponse);
    }
    refresh(id, req) {
        return this.oauth.refreshIntegration(id, req.organizationId).then(integration_response_1.toIntegrationResponse);
    }
    disconnect(id, req) {
        return this.oauth.disconnectIntegration(id, req.organizationId).then(integration_response_1.toIntegrationResponse);
    }
    listAccounts(id, req) {
        return this.data.listAccounts(id, req.organizationId);
    }
    discoverAds(id, req) { return this.data.discoverAdsAccounts(id, req.organizationId); }
    registerAnalytics(id, dto, req) { return this.data.registerAnalyticsProperty(id, req.organizationId, dto.propertyId, dto.name, dto.clientId); }
    syncData(id, req) { return this.data.sync(id, req.organizationId); }
};
exports.GoogleController = GoogleController;
__decorate([
    (0, common_1.Get)('auth-url'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Google OAuth authorization URL' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('redirect_uri')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GoogleController.prototype, "getAuthUrl", null);
__decorate([
    (0, common_1.Get)('status'),
    (0, swagger_1.ApiOperation)({ summary: 'Check Google integration configuration status' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GoogleController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('callback'),
    (0, swagger_1.ApiOperation)({ summary: 'Handle Google OAuth callback' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [google_oauth_callback_dto_1.GoogleOAuthCallbackDto, Object]),
    __metadata("design:returntype", void 0)
], GoogleController.prototype, "handleCallback", null);
__decorate([
    (0, common_1.Post)(':id/refresh'),
    (0, swagger_1.ApiOperation)({ summary: 'Refresh Google OAuth access token' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GoogleController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)(':id/disconnect'),
    (0, swagger_1.ApiOperation)({ summary: 'Revoke Google access and clear local credentials' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GoogleController.prototype, "disconnect", null);
__decorate([
    (0, common_1.Get)(':id/accounts'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GoogleController.prototype, "listAccounts", null);
__decorate([
    (0, common_1.Post)(':id/ads/discover'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GoogleController.prototype, "discoverAds", null);
__decorate([
    (0, common_1.Post)(':id/analytics-properties'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, register_analytics_property_dto_1.RegisterAnalyticsPropertyDto, Object]),
    __metadata("design:returntype", void 0)
], GoogleController.prototype, "registerAnalytics", null);
__decorate([
    (0, common_1.Post)(':id/data/sync'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    (0, throttler_1.Throttle)({ default: { limit: 4, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GoogleController.prototype, "syncData", null);
exports.GoogleController = GoogleController = __decorate([
    (0, swagger_1.ApiTags)('Google Integrations'),
    (0, common_1.Controller)('integrations/google'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, module_scope_decorator_1.ModuleScope)('integrations'),
    __metadata("design:paramtypes", [google_oauth_service_1.GoogleOAuthService, google_data_service_1.GoogleDataService])
], GoogleController);
