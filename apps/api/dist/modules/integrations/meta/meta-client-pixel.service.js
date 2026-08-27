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
    credenciales(integration) {
        const value = integration.config?.metaPixels;
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
    tokenDePixel(integration, pixelId) {
        if (!integration)
            return process.env.META_CONVERSIONS_ACCESS_TOKEN || undefined;
        const credencial = this.credenciales(integration)[pixelId];
        if (credencial?.accessToken)
            return (0, integration_secrets_1.revealSecret)(credencial.accessToken);
        const heredado = Object.values(this.records(integration)).find((item) => (item.pixelId === pixelId && item.accessToken));
        return (0, integration_secrets_1.revealSecret)(heredado?.accessToken) || process.env.META_CONVERSIONS_ACCESS_TOKEN || undefined;
    }
    records(integration) {
        const value = integration.config?.clientPixels;
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
    async mutateRecords(integrationId, mutate) {
        return this.integrations.manager.transaction(async (manager) => {
            const repo = manager.getRepository(integration_entity_1.Integration);
            const fresh = await repo.findOne({ where: { id: integrationId }, lock: { mode: 'pessimistic_write' } });
            if (!fresh)
                throw new common_1.NotFoundException('Integración Meta no encontrada');
            const current = this.records(fresh);
            const [next, result] = await mutate(current);
            fresh.config = { ...fresh.config, clientPixels: next };
            await repo.save(fresh);
            return result;
        });
    }
    async list(id, organizationId) {
        const integration = await this.integration(id, organizationId);
        return this.catalogRows(organizationId, this.records(integration), this.credenciales(integration));
    }
    tokenPropioDe(record, credenciales) {
        if (!record)
            return false;
        return Boolean(credenciales[record.pixelId]?.accessToken || record.accessToken);
    }
    async catalogRows(organizationId, records, credenciales = {}) {
        const clients = await this.clients.find({ where: { organizationId }, order: { name: 'ASC' } });
        return clients.map((client) => ({
            clientId: client.id,
            clientName: client.name,
            pixelId: records[client.id]?.pixelId || null,
            pixelName: records[client.id]?.pixelName || null,
            tokenConfigured: Boolean(records[client.id]?.accessToken || process.env.META_CONVERSIONS_ACCESS_TOKEN),
            tokenPropio: Boolean(this.tokenPropioDe(records[client.id], credenciales)),
            tokenHeredado: !this.tokenPropioDe(records[client.id], credenciales)
                && Boolean(process.env.META_CONVERSIONS_ACCESS_TOKEN),
            configuredAt: records[client.id]?.configuredAt || null,
        }));
    }
    async catalog(organizationId) {
        const integration = await this.organizationIntegration(organizationId);
        const records = integration ? this.records(integration) : {};
        const credenciales = integration ? this.credenciales(integration) : {};
        const bindings = await this.catalogRows(organizationId, records, credenciales);
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
                tokenConfigured: Boolean(credenciales[pixelId]?.accessToken || record?.accessToken || process.env.META_CONVERSIONS_ACCESS_TOKEN),
            };
        });
        const sinAsignar = Object.keys(credenciales)
            .filter((pixelId) => !pixels.some((registrado) => registrado.pixelId === pixelId))
            .map((pixelId) => ({
            pixelId,
            clientNames: [],
            pixelNames: credenciales[pixelId].name ? [credenciales[pixelId].name] : [],
            usageCount: 0,
            tokenConfigured: Boolean(credenciales[pixelId].accessToken),
        }));
        return { bindings, pixels: [...pixels, ...sinAsignar] };
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
        const token = accessToken?.trim() || this.tokenDePixel(integration, pixelId);
        if (!token)
            throw new common_1.BadRequestException('Se requiere un token CAPI para este cliente');
        if (!await this.pixels.validatePixel(pixelId, token))
            throw new common_1.BadRequestException('Meta no reconoció el Pixel con el token entregado');
        return this.mutateRecords(integration.id, (records) => {
            const current = records[clientId];
            const record = {
                pixelId,
                pixelName: pixelName?.trim() || current?.pixelName || client.name,
                accessToken: current?.accessToken,
                configuredAt: new Date().toISOString(),
            };
            return [
                { ...records, [clientId]: record },
                { clientId, clientName: client.name, pixelId, pixelName: record.pixelName || client.name, tokenConfigured: true, configuredAt: record.configuredAt },
            ];
        });
    }
    async setup(organizationId, clientId, mode, input) {
        const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
        if (!client)
            throw new common_1.NotFoundException('Cliente no encontrado');
        const integration = await this.organizationIntegration(organizationId, mode !== 'none');
        if (!integration)
            return { clientId, clientName: client.name, pixelId: null, tokenConfigured: false, configuredAt: null };
        if (mode === 'none') {
            return this.mutateRecords(integration.id, (records) => {
                const { [clientId]: _removed, ...rest } = records;
                return [rest, { clientId, clientName: client.name, pixelId: null, tokenConfigured: false, configuredAt: null }];
            });
        }
        if (mode === 'existing') {
            return this.mutateRecords(integration.id, (records) => {
                const source = Object.values(records).find((record) => record.pixelId === input.existingPixelId);
                if (!source)
                    throw new common_1.BadRequestException('El Pixel existente no está disponible en esta organización');
                const configuredAt = new Date().toISOString();
                const record = { ...source, pixelName: input.pixelName?.trim() || source.pixelName || client.name, configuredAt };
                return [
                    { ...records, [clientId]: record },
                    { clientId, clientName: client.name, pixelId: source.pixelId, pixelName: record.pixelName || null, tokenConfigured: Boolean(source.accessToken || process.env.META_CONVERSIONS_ACCESS_TOKEN), configuredAt },
                ];
            });
        }
        if (!input.pixelId)
            throw new common_1.BadRequestException('Debes indicar el ID del Pixel');
        return this.configureRecord(integration, organizationId, clientId, input.pixelId, input.accessToken, input.pixelName);
    }
    async resolve(organizationId, clientId) {
        const integration = await this.organizationIntegration(organizationId);
        const record = integration ? this.records(integration)[clientId] : undefined;
        return {
            pixelId: record?.pixelId || '',
            pixelName: record?.pixelName || null,
            accessToken: record?.pixelId
                ? this.tokenDePixel(integration, record.pixelId)
                : process.env.META_CONVERSIONS_ACCESS_TOKEN,
        };
    }
    async resolveForScope(organizationId, clientId, pixelPropio) {
        const porDefecto = clientId
            ? await this.resolve(organizationId, clientId)
            : { pixelId: '', pixelName: null, accessToken: undefined };
        const propio = pixelPropio?.trim();
        const pixelId = propio || porDefecto.pixelId || '';
        if (!pixelId)
            return { pixelId: '', pixelName: null, pixelSource: 'none', tokenSource: 'none' };
        const pixelSource = propio ? 'scope' : 'client';
        if (pixelSource === 'client') {
            return {
                pixelId,
                pixelName: porDefecto.pixelName ?? null,
                accessToken: porDefecto.accessToken,
                pixelSource,
                tokenSource: porDefecto.accessToken
                    ? (process.env.META_CONVERSIONS_ACCESS_TOKEN === porDefecto.accessToken ? 'environment' : 'client')
                    : 'none',
            };
        }
        const integration = await this.organizationIntegration(organizationId);
        const registro = integration
            ? Object.values(this.records(integration)).find((item) => item.pixelId === pixelId)
            : undefined;
        const propioToken = (0, integration_secrets_1.revealSecret)(registro?.accessToken);
        if (propioToken)
            return { pixelId, pixelName: registro?.pixelName ?? null, accessToken: propioToken, pixelSource, tokenSource: 'pixel' };
        const entorno = process.env.META_CONVERSIONS_ACCESS_TOKEN;
        return {
            pixelId,
            pixelName: registro?.pixelName ?? null,
            accessToken: entorno,
            pixelSource,
            tokenSource: entorno ? 'environment' : 'none',
        };
    }
    async resolveByPixel(organizationId, pixelId) {
        const integration = await this.organizationIntegration(organizationId);
        return this.tokenDePixel(integration, pixelId);
    }
    async guardarCredencial(organizationId, pixelId, datos) {
        const integration = await this.organizationIntegration(organizationId, true);
        if (!integration)
            throw new common_1.NotFoundException('Integración Meta no encontrada');
        const limpio = pixelId.trim();
        if (!limpio)
            throw new common_1.BadRequestException('Debes indicar el ID del Pixel');
        const nuevo = datos.accessToken?.trim();
        const token = nuevo || this.tokenDePixel(integration, limpio);
        if (!token)
            throw new common_1.BadRequestException('Se requiere un token CAPI para este Pixel');
        if (!await this.pixels.validatePixel(limpio, token)) {
            throw new common_1.BadRequestException('Meta no reconoció el Pixel con el token entregado');
        }
        return this.integrations.manager.transaction(async (manager) => {
            const repo = manager.getRepository(integration_entity_1.Integration);
            const fresh = await repo.findOne({ where: { id: integration.id }, lock: { mode: 'pessimistic_write' } });
            if (!fresh)
                throw new common_1.NotFoundException('Integración Meta no encontrada');
            const actuales = this.credenciales(fresh);
            const previa = actuales[limpio];
            const credencial = {
                name: datos.name?.trim() || previa?.name,
                accessToken: nuevo ? (0, integration_secrets_1.protectSecret)(nuevo) : previa?.accessToken ?? this.tokenGuardadoEnEmpresa(fresh, limpio),
                updatedAt: new Date().toISOString(),
            };
            fresh.config = { ...fresh.config, metaPixels: { ...actuales, [limpio]: credencial } };
            await repo.save(fresh);
            return { pixelId: limpio, name: credencial.name ?? null, tokenConfigured: Boolean(credencial.accessToken) };
        });
    }
    async quitarCredencial(organizationId, pixelId) {
        const integration = await this.organizationIntegration(organizationId);
        if (!integration)
            throw new common_1.NotFoundException('Integración Meta no encontrada');
        return this.integrations.manager.transaction(async (manager) => {
            const repo = manager.getRepository(integration_entity_1.Integration);
            const fresh = await repo.findOne({ where: { id: integration.id }, lock: { mode: 'pessimistic_write' } });
            if (!fresh)
                throw new common_1.NotFoundException('Integración Meta no encontrada');
            const { [pixelId]: quitada, ...resto } = this.credenciales(fresh);
            if (!quitada)
                throw new common_1.NotFoundException('Ese Pixel no tiene credencial registrada');
            fresh.config = { ...fresh.config, metaPixels: resto };
            await repo.save(fresh);
            return { pixelId, quedaHeredado: Boolean(this.tokenGuardadoEnEmpresa(fresh, pixelId)) };
        });
    }
    tokenGuardadoEnEmpresa(integration, pixelId) {
        return Object.values(this.records(integration)).find((item) => (item.pixelId === pixelId && item.accessToken))?.accessToken;
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
