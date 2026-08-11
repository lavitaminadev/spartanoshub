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
exports.GoogleOAuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const integration_entity_1 = require("../integration.entity");
const integration_provider_enum_1 = require("../integration-provider.enum");
const integration_status_enum_1 = require("../integration-status.enum");
const integration_secrets_1 = require("../../../shared/security/integration-secrets");
let GoogleOAuthService = class GoogleOAuthService {
    constructor(integrations) {
        this.integrations = integrations;
    }
    getAuthorizationUrl(redirectUri, state) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
            throw new common_1.ServiceUnavailableException('Google aún no está configurado en el entorno del servidor');
        }
        const scopes = [
            'https://www.googleapis.com/auth/adwords',
            'https://www.googleapis.com/auth/analytics.readonly',
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/calendar.events',
        ].join(' ');
        return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
    }
    getClientId() {
        return process.env.GOOGLE_CLIENT_ID;
    }
    isConfigured() {
        return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    }
    async disconnectIntegration(id, organizationId) {
        const integration = await this.integrations.findOne({
            where: { id, organizationId, provider: integration_provider_enum_1.IntegrationProvider.GOOGLE },
        });
        if (!integration)
            throw new common_1.BadRequestException('Google integration not found');
        const token = (0, integration_secrets_1.revealSecret)(typeof integration.config?.accessToken === 'string' ? integration.config.accessToken : undefined);
        if (token) {
            try {
                await fetch('https://oauth2.googleapis.com/revoke', {
                    method: 'POST',
                    headers: { 'content-type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ token }),
                    signal: AbortSignal.timeout(10000),
                });
            }
            catch {
            }
        }
        integration.status = integration_status_enum_1.IntegrationStatus.DISABLED;
        integration.config = {};
        integration.errorMessage = undefined;
        return this.integrations.save(integration);
    }
    async connectWithCode(organizationId, code, redirectUri) {
        const tokens = await this.exchangeCode(code, redirectUri);
        return this.upsertIntegration(organizationId, {
            config: {
                accessToken: (0, integration_secrets_1.protectSecret)(tokens.access_token),
                refreshToken: tokens.refresh_token ? (0, integration_secrets_1.protectSecret)(tokens.refresh_token) : undefined,
                scope: tokens.scope,
                tokenType: tokens.token_type,
                expiryDate: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : undefined,
            },
            status: integration_status_enum_1.IntegrationStatus.ACTIVE,
        });
    }
    async refreshIntegration(id, organizationId) {
        const integration = await this.integrations.findOne({
            where: { id, organizationId, provider: integration_provider_enum_1.IntegrationProvider.GOOGLE },
        });
        if (!integration)
            throw new common_1.BadRequestException('Google integration not found');
        const refreshToken = (0, integration_secrets_1.revealSecret)(typeof integration.config?.refreshToken === 'string' ? integration.config.refreshToken : undefined);
        if (!refreshToken)
            throw new common_1.BadRequestException('Google refresh token is missing');
        const tokens = await this.refreshAccessToken(refreshToken);
        integration.status = integration_status_enum_1.IntegrationStatus.ACTIVE;
        integration.lastSyncAt = new Date();
        integration.errorMessage = undefined;
        integration.config = {
            ...integration.config,
            accessToken: (0, integration_secrets_1.protectSecret)(tokens.access_token),
            tokenType: tokens.token_type,
            scope: tokens.scope ?? integration.config?.scope,
            expiryDate: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : integration.config?.expiryDate,
        };
        return this.integrations.save(integration);
    }
    async exchangeCode(code, redirectUri) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret)
            throw new common_1.BadRequestException('Google OAuth is not configured');
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
            signal: AbortSignal.timeout(15000),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new common_1.BadRequestException('Google OAuth token exchange failed');
        }
        return data;
    }
    async refreshAccessToken(refreshToken) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret)
            throw new common_1.BadRequestException('Google OAuth is not configured');
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }),
            signal: AbortSignal.timeout(15000),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new common_1.BadRequestException('Google token refresh failed');
        }
        return data;
    }
    async upsertIntegration(organizationId, data) {
        const existing = await this.integrations.findOne({
            where: { organizationId, provider: integration_provider_enum_1.IntegrationProvider.GOOGLE },
        });
        if (existing) {
            existing.status = data.status;
            existing.config = data.config;
            existing.lastSyncAt = new Date();
            existing.errorMessage = undefined;
            return this.integrations.save(existing);
        }
        const integration = this.integrations.create({
            organizationId,
            provider: integration_provider_enum_1.IntegrationProvider.GOOGLE,
            name: 'Google',
            status: data.status,
            config: data.config,
            lastSyncAt: new Date(),
        });
        return this.integrations.save(integration);
    }
};
exports.GoogleOAuthService = GoogleOAuthService;
exports.GoogleOAuthService = GoogleOAuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(integration_entity_1.Integration)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], GoogleOAuthService);
//# sourceMappingURL=google-oauth.service.js.map