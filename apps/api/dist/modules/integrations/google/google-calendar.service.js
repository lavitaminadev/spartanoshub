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
exports.GoogleCalendarService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const integration_entity_1 = require("../integration.entity");
const integration_provider_enum_1 = require("../integration-provider.enum");
const integration_secrets_1 = require("../../../shared/security/integration-secrets");
const google_oauth_service_1 = require("./google-oauth.service");
let GoogleCalendarService = class GoogleCalendarService {
    constructor(integrations, oauth) {
        this.integrations = integrations;
        this.oauth = oauth;
    }
    async createEvent(organizationId, event) {
        let integration = await this.integrations.findOne({ where: { organizationId, provider: integration_provider_enum_1.IntegrationProvider.GOOGLE } });
        if (!integration)
            throw new common_1.BadRequestException('Google is not connected');
        integration = await this.refreshIfExpiring(integration, organizationId);
        let token = this.revealAccessToken(integration);
        let response;
        try {
            response = await this.sendEvent(token, event);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown network error';
            throw new common_1.BadRequestException(`Google Calendar request failed: ${message}`);
        }
        if (response.status === 401) {
            integration = await this.oauth.refreshIntegration(integration.id, organizationId);
            token = this.revealAccessToken(integration);
            try {
                response = await this.sendEvent(token, event);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown network error';
                throw new common_1.BadRequestException(`Google Calendar request failed: ${message}`);
            }
        }
        const data = await response.json();
        if (!response.ok)
            throw new common_1.BadRequestException(data.error?.message ?? 'Google Calendar event creation failed');
        return { externalId: data.id, calendarUrl: data.htmlLink, meetingLink: data.hangoutLink };
    }
    async refreshIfExpiring(integration, organizationId) {
        const expiry = typeof integration.config?.expiryDate === 'string' ? new Date(integration.config.expiryDate).getTime() : Number.NaN;
        if (Number.isFinite(expiry) && expiry <= Date.now() + 60_000)
            return this.oauth.refreshIntegration(integration.id, organizationId);
        return integration;
    }
    revealAccessToken(integration) {
        const token = (0, integration_secrets_1.revealSecret)(typeof integration.config?.accessToken === 'string' ? integration.config.accessToken : undefined);
        if (!token)
            throw new common_1.BadRequestException('Google access token is unavailable');
        return token;
    }
    sendEvent(token, event) {
        const end = new Date(event.start.getTime() + event.durationMinutes * 60_000);
        return fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
            method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
            body: JSON.stringify({ summary: event.summary, description: event.description, start: { dateTime: event.start.toISOString() }, end: { dateTime: end.toISOString() }, conferenceData: { createRequest: { requestId: `espartanos-${crypto.randomUUID()}` } } }),
        });
    }
};
exports.GoogleCalendarService = GoogleCalendarService;
exports.GoogleCalendarService = GoogleCalendarService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(integration_entity_1.Integration)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        google_oauth_service_1.GoogleOAuthService])
], GoogleCalendarService);
