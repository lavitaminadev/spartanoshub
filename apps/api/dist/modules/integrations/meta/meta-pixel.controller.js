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
exports.MetaPixelController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const meta_pixel_service_1 = require("./meta-pixel.service");
const meta_conversions_service_1 = require("./meta-conversions.service");
const meta_oauth_service_1 = require("./meta-oauth.service");
const meta_asset_discovery_service_1 = require("./meta-asset-discovery.service");
const meta_lead_ads_service_1 = require("./meta-lead-ads.service");
const roles_decorator_1 = require("../../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../../organizations/user-role.enum");
const integration_response_1 = require("../integration-response");
const meta_integration_dto_1 = require("./dto/meta-integration.dto");
const oauth_state_1 = require("../../../shared/security/oauth-state");
const meta_insights_service_1 = require("./meta-insights.service");
const oauth_redirect_1 = require("../../../shared/security/oauth-redirect");
const meta_client_pixel_service_1 = require("./meta-client-pixel.service");
const meta_conversion_outbox_service_1 = require("./meta-conversion-outbox.service");
const module_scope_decorator_1 = require("../../../core/authorization/module-scope.decorator");
const requires_recent_auth_decorator_1 = require("../../../core/auth/requires-recent-auth.decorator");
let MetaPixelController = class MetaPixelController {
    constructor(pixel, conversions, oauth, assetDiscovery, metaLeadAds, insights, clientPixels, conversionOutbox) {
        this.pixel = pixel;
        this.conversions = conversions;
        this.oauth = oauth;
        this.assetDiscovery = assetDiscovery;
        this.metaLeadAds = metaLeadAds;
        this.insights = insights;
        this.clientPixels = clientPixels;
        this.conversionOutbox = conversionOutbox;
    }
    clientPixelCatalog(req) {
        return this.clientPixels.catalog(req.organizationId);
    }
    async conversionsOutbox(req) {
        const [stats, problems] = await Promise.all([
            this.conversionOutbox.stats(req.organizationId),
            this.conversionOutbox.recentProblems(req.organizationId),
        ]);
        return {
            stats,
            problems: problems.map((item) => ({
                id: item.id,
                eventId: item.eventId,
                pixelId: item.pixelId,
                eventName: item.eventData?.eventName ?? null,
                status: item.status,
                attempts: item.attempts,
                lastError: item.lastError ?? null,
                nextAttemptAt: item.nextAttemptAt ?? null,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            })),
        };
    }
    setupClientPixel(dto, req) {
        return this.clientPixels.setup(req.organizationId, dto.clientId, dto.mode, dto);
    }
    guardarCredencialDePixel(dto, req) {
        return this.clientPixels.guardarCredencial(req.organizationId, dto.pixelId, dto);
    }
    quitarCredencialDePixel(pixelId, req) {
        return this.clientPixels.quitarCredencial(req.organizationId, pixelId);
    }
    listClientPixels(id, req) {
        return this.clientPixels.list(id, req.organizationId);
    }
    configureClientPixel(id, dto, req) {
        return this.clientPixels.configure(id, req.organizationId, dto.clientId, dto.pixelId, dto.accessToken, dto.pixelName);
    }
    getAuthUrl(req, redirectUri) {
        const uri = (0, oauth_redirect_1.resolveOAuthRedirect)('meta', redirectUri);
        const state = (0, oauth_state_1.createOAuthState)('meta', req.organizationId, uri);
        return { url: this.oauth.getAuthorizationUrl(uri, state) };
    }
    getStatus() {
        return {
            configured: this.oauth.isConfigured(),
            appId: this.oauth.getAppId() || null,
        };
    }
    handleCallback(dto, req) {
        const redirectUri = (0, oauth_redirect_1.resolveOAuthRedirect)('meta', dto.redirectUri);
        (0, oauth_state_1.verifyOAuthState)(dto.state, { provider: 'meta', organizationId: req.organizationId, redirectUri });
        return this.oauth.connectWithCode(req.organizationId, dto.code, redirectUri).then(integration_response_1.toIntegrationResponse);
    }
    refresh(id, req) {
        return this.oauth.refreshIntegration(id, req.organizationId).then(integration_response_1.toIntegrationResponse);
    }
    disconnect(id, req) {
        return this.oauth.disconnectIntegration(id, req.organizationId).then(integration_response_1.toIntegrationResponse);
    }
    assets(id, req) {
        return this.assetDiscovery.discoverAssets(id, req.organizationId);
    }
    saveAssets(id, dto, req) {
        return this.assetDiscovery.saveSelectedAssets(id, req.organizationId, dto);
    }
    health(id, req) {
        return this.oauth.getIntegrationHealth(id, req.organizationId);
    }
    syncInsights(id, req) {
        return this.insights.sync(id, req.organizationId);
    }
    syncLead(dto, req) {
        const pageId = dto.pageId?.trim();
        const leadgenId = dto.leadgenId?.trim();
        if (!pageId || !leadgenId) {
            throw new common_1.BadRequestException('pageId and leadgenId are required');
        }
        return this.metaLeadAds.syncSingleLead(pageId, leadgenId, req.organizationId);
    }
    async validate(id, dto, req) {
        const accessToken = await this.oauth.getSecureAccessToken(id, req.organizationId);
        const valid = await this.pixel.validatePixel(dto.pixelId, accessToken);
        if (valid)
            await this.oauth.savePixelId(id, req.organizationId, dto.pixelId);
        return { valid };
    }
    async sendConversionTest(id, req) {
        const pixelId = await this.oauth.getPixelId(id, req.organizationId);
        if (!pixelId)
            throw new common_1.BadRequestException('Validate a Meta pixel before sending a test event');
        if (!process.env.META_TEST_EVENT_CODE)
            throw new common_1.BadRequestException('META_TEST_EVENT_CODE is required for test events');
        const accessToken = process.env.META_CONVERSIONS_ACCESS_TOKEN
            || await this.oauth.getSecureAccessToken(id, req.organizationId);
        return this.conversions.sendServerEvent(pixelId, accessToken, {
            eventName: 'Lead',
            eventTime: Math.floor(Date.now() / 1000),
            actionSource: 'system_generated',
            userData: { externalId: [`espartanos-test-${id}`] },
            eventId: `espartanos-test-${Date.now()}`,
        });
    }
};
exports.MetaPixelController = MetaPixelController;
__decorate([
    (0, common_1.Get)('client-pixels/catalog'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "clientPixelCatalog", null);
__decorate([
    (0, common_1.Get)('conversions/outbox'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Estado de la cola de conversiones a Meta' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MetaPixelController.prototype, "conversionsOutbox", null);
__decorate([
    (0, common_1.Post)('client-pixels/setup'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [meta_integration_dto_1.MetaClientPixelSetupDto, Object]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "setupClientPixel", null);
__decorate([
    (0, common_1.Post)('pixels'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [meta_integration_dto_1.MetaPixelCredentialDto, Object]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "guardarCredencialDePixel", null);
__decorate([
    (0, common_1.Delete)('pixels/:pixelId'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Param)('pixelId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "quitarCredencialDePixel", null);
__decorate([
    (0, common_1.Get)(':id/client-pixels'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "listClientPixels", null);
__decorate([
    (0, common_1.Post)(':id/client-pixels'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, meta_integration_dto_1.MetaClientPixelDto, Object]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "configureClientPixel", null);
__decorate([
    (0, common_1.Get)('auth-url'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Meta OAuth authorization URL' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('redirect_uri')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "getAuthUrl", null);
__decorate([
    (0, common_1.Get)('status'),
    (0, swagger_1.ApiOperation)({ summary: 'Check Meta integration configuration status' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('callback'),
    (0, swagger_1.ApiOperation)({ summary: 'Handle Meta OAuth callback' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [meta_integration_dto_1.MetaOAuthCallbackDto, Object]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "handleCallback", null);
__decorate([
    (0, common_1.Post)(':id/refresh'),
    (0, swagger_1.ApiOperation)({ summary: 'Refresh Meta access token' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "refresh", null);
__decorate([
    (0, requires_recent_auth_decorator_1.RequiresRecentAuth)('desconectar la integración con Meta'),
    (0, common_1.Post)(':id/disconnect'),
    (0, swagger_1.ApiOperation)({ summary: 'Unsubscribe Meta pages and clear credentials' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "disconnect", null);
__decorate([
    (0, common_1.Get)(':id/assets'),
    (0, swagger_1.ApiOperation)({ summary: 'Discover available Meta assets and current selection' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "assets", null);
__decorate([
    (0, common_1.Post)(':id/assets'),
    (0, swagger_1.ApiOperation)({ summary: 'Persist selected Meta assets' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, meta_integration_dto_1.MetaAssetSelectionDto, Object]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "saveAssets", null);
__decorate([
    (0, common_1.Get)(':id/health'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Meta integration health' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "health", null);
__decorate([
    (0, common_1.Post)(':id/insights/sync'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, throttler_1.Throttle)({ default: { limit: 4, ttl: 60000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Sincronizar 30 dias de Meta Ads Insights' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "syncInsights", null);
__decorate([
    (0, common_1.Post)('leads/sync'),
    (0, swagger_1.ApiOperation)({ summary: 'Manually sync a Meta lead by page and leadgen id' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, throttler_1.Throttle)({ default: { limit: 12, ttl: 60000 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [meta_integration_dto_1.MetaLeadSyncDto, Object]),
    __metadata("design:returntype", void 0)
], MetaPixelController.prototype, "syncLead", null);
__decorate([
    (0, common_1.Post)(':id/pixel/validate'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, meta_integration_dto_1.MetaPixelDto, Object]),
    __metadata("design:returntype", Promise)
], MetaPixelController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)(':id/conversions/test'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MetaPixelController.prototype, "sendConversionTest", null);
exports.MetaPixelController = MetaPixelController = __decorate([
    (0, common_1.Controller)('integrations/meta'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, module_scope_decorator_1.ModuleScope)('integrations'),
    __metadata("design:paramtypes", [meta_pixel_service_1.MetaPixelService,
        meta_conversions_service_1.MetaConversionsService,
        meta_oauth_service_1.MetaOAuthService,
        meta_asset_discovery_service_1.MetaAssetDiscoveryService,
        meta_lead_ads_service_1.MetaLeadAdsService,
        meta_insights_service_1.MetaInsightsService,
        meta_client_pixel_service_1.MetaClientPixelService,
        meta_conversion_outbox_service_1.MetaConversionOutboxService])
], MetaPixelController);
