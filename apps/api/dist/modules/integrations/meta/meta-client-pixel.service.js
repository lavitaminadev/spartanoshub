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
exports.MetaClientPixelService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const client_entity_1 = require("../../clients/client.entity");
const integration_secrets_1 = require("../../../shared/security/integration-secrets");
const integration_entity_1 = require("../integration.entity");
const integration_provider_enum_1 = require("../integration-provider.enum");
const integration_status_enum_1 = require("../integration-status.enum");
const meta_pixel_service_1 = require("./meta-pixel.service");
let MetaClientPixelService = class MetaClientPixelService {
    constructor(integrations, clients, pixels) {
        this.integrations = integrations;
        this.clients = clients;
        this.pixels = pixels;
    }
    async integration(id, organizationId) {
        const integration = await this.integrations.findOne({ where: { id, organizationId, provider: integration_provider_enum_1.IntegrationProvider.META } });
        if (!integration)
            throw new common_1.NotFoundException('Integración Meta no encontrada');
        return integration;
    }
    async organizationIntegration(organizationId, create = false) {
        let integration = await this.integrations.findOne({
            where: { organizationId, provider: integration_provider_enum_1.IntegrationProvider.META },
            order: { createdAt: 'ASC' },
        });
        if (!integration && create) {
            integration = await this.integrations.save(this.integrations.create({
                organizationId,
                provider: integration_provider_enum_1.IntegrationProvider.META,
                name: 'Meta CAPI',
                status: integration_status_enum_1.IntegrationStatus.PENDING,
                config: { directCapi: true, clientPixels: {} },
            }));
        }
        return integration;
    }
    records(integration) {
        const value = integration.config?.clientPixels;
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
    async list(id, organizationId) {
        const integration = await this.integration(id, organizationId);
        return this.catalogRows(organizationId, this.records(integration));
    }
    async catalogRows(organizationId, records) {
        const clients = await this.clients.find({ where: { organizationId }, order: { name: 'ASC' } });
        return clients.map((client) => ({
            clientId: client.id,
            clientName: client.name,
            pixelId: records[client.id]?.pixelId || null,
            pixelName: records[client.id]?.pixelName || null,
            tokenConfigured: Boolean(records[client.id]?.accessToken || process.env.META_CONVERSIONS_ACCESS_TOKEN),
            configuredAt: records[client.id]?.configuredAt || null,
        }));
    }
    async catalog(organizationId) {
        const integration = await this.organizationIntegration(organizationId);
        const records = integration ? this.records(integration) : {};
        const bindings = await this.catalogRows(organizationId, records);
        const pixels = Array.from(new Set(Object.values(records).map((record) => record.pixelId))).map((pixelId) => {
            const matched = bindings.filter((binding) => binding.pixelId === pixelId);
            const clients = matched.map((binding) => binding.clientName);
            const names = matched.map((binding) => binding.pixelName).filter(Boolean);
            const record = Object.values(records).find((item) => item.pixelId === pixelId);
            return {
                pixelId,
                clientNames: clients,
                pixelNames: names,
                usageCount: clients.length,
                tokenConfigured: Boolean(record?.accessToken || process.env.META_CONVERSIONS_ACCESS_TOKEN),
            };
        });
        return { bindings, pixels };
    }
    async configure(id, organizationId, clientId, pixelId, accessToken, pixelName) {
        const integration = await this.integration(id, organizationId);
        return this.configureRecord(integration, organizationId, clientId, pixelId, accessToken, pixelName);
    }
    async configureRecord(integration, organizationId, clientId, pixelId, accessToken, pixelName) {
        const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
        if (!client)
            throw new common_1.NotFoundException('Cliente no encontrado');
        const existing = this.records(integration)[clientId];
        const token = accessToken?.trim() || (0, integration_secrets_1.revealSecret)(existing?.accessToken) || process.env.META_CONVERSIONS_ACCESS_TOKEN;
        if (!token)
            throw new common_1.BadRequestException('Se requiere un token CAPI para este cliente');
        if (!await this.pixels.validatePixel(pixelId, token))
            throw new common_1.BadRequestException('Meta no reconoció el Pixel con el token entregado');
        const clientPixels = {
            ...this.records(integration),
            [clientId]: {
                pixelId,
                pixelName: pixelName?.trim() || existing?.pixelName || client.name,
                accessToken: accessToken?.trim() ? (0, integration_secrets_1.protectSecret)(accessToken.trim()) : existing?.accessToken,
                configuredAt: new Date().toISOString(),
            },
        };
        integration.config = { ...integration.config, clientPixels };
        await this.integrations.save(integration);
        return { clientId, clientName: client.name, pixelId, pixelName: clientPixels[clientId].pixelName || client.name, tokenConfigured: true, configuredAt: clientPixels[clientId].configuredAt };
    }
    async setup(organizationId, clientId, mode, input) {
        const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
        if (!client)
            throw new common_1.NotFoundException('Cliente no encontrado');
        const integration = await this.organizationIntegration(organizationId, mode !== 'none');
        if (!integration)
            return { clientId, clientName: client.name, pixelId: null, tokenConfigured: false, configuredAt: null };
        const records = this.records(integration);
        if (mode === 'none') {
            delete records[clientId];
            integration.config = { ...integration.config, clientPixels: records };
            await this.integrations.save(integration);
            return { clientId, clientName: client.name, pixelId: null, tokenConfigured: false, configuredAt: null };
        }
        if (mode === 'existing') {
            const source = Object.values(records).find((record) => record.pixelId === input.existingPixelId);
            if (!source)
                throw new common_1.BadRequestException('El Pixel existente no está disponible en esta organización');
            const configuredAt = new Date().toISOString();
            records[clientId] = { ...source, pixelName: input.pixelName?.trim() || source.pixelName || client.name, configuredAt };
            integration.config = { ...integration.config, clientPixels: records };
            await this.integrations.save(integration);
            return { clientId, clientName: client.name, pixelId: source.pixelId, pixelName: records[clientId].pixelName || null, tokenConfigured: Boolean(source.accessToken || process.env.META_CONVERSIONS_ACCESS_TOKEN), configuredAt };
        }
        if (!input.pixelId)
            throw new common_1.BadRequestException('Debes indicar el ID del Pixel');
        const result = await this.configureRecord(integration, organizationId, clientId, input.pixelId, input.accessToken, input.pixelName);
        if (input.pixelName?.trim()) {
            const updated = this.records(integration);
            updated[clientId] = { ...updated[clientId], pixelName: input.pixelName.trim() };
            integration.config = { ...integration.config, clientPixels: updated };
            await this.integrations.save(integration);
            return { ...result, pixelName: input.pixelName.trim() };
        }
        return { ...result, pixelName: result.clientName };
    }
    async resolve(organizationId, clientId) {
        const integration = await this.organizationIntegration(organizationId);
        const record = integration ? this.records(integration)[clientId] : undefined;
        return {
            pixelId: record?.pixelId || '',
            pixelName: record?.pixelName || null,
            accessToken: (0, integration_secrets_1.revealSecret)(record?.accessToken) || process.env.META_CONVERSIONS_ACCESS_TOKEN,
        };
    }
    async resolveByPixel(organizationId, pixelId) {
        const integration = await this.organizationIntegration(organizationId);
        const record = integration ? Object.values(this.records(integration)).find((item) => item.pixelId === pixelId) : undefined;
        const token = (record?.accessToken ? (0, integration_secrets_1.revealSecret)(record.accessToken) : undefined) || process.env.META_CONVERSIONS_ACCESS_TOKEN;
        return token || undefined;
    }
};
exports.MetaClientPixelService = MetaClientPixelService;
exports.MetaClientPixelService = MetaClientPixelService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(integration_entity_1.Integration)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        meta_pixel_service_1.MetaPixelService])
], MetaClientPixelService);
