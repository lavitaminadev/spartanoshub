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
exports.MetaAssetDiscoveryService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const integration_entity_1 = require("../integration.entity");
const integration_account_entity_1 = require("../integration-account.entity");
const integration_account_type_enum_1 = require("../integration-account-type.enum");
const integration_secrets_1 = require("../../../shared/security/integration-secrets");
const meta_integration_accessor_service_1 = require("./meta-integration-accessor.service");
let MetaAssetDiscoveryService = class MetaAssetDiscoveryService {
    constructor(integrations, accounts, accessor) {
        this.integrations = integrations;
        this.accounts = accounts;
        this.accessor = accessor;
    }
    async discoverAssets(integrationId, organizationId) {
        const integration = await this.accessor.requireIntegration(integrationId, organizationId);
        const accessToken = this.accessor.getAccessToken(integration);
        const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
        const [pagesResponse, adAccountsResponse] = await Promise.all([
            this.fetchGraph(version, '/me/accounts', accessToken, {
                fields: 'id,name,access_token,category,connected_instagram_account{id,username}',
            }),
            this.fetchGraph(version, '/me/adaccounts', accessToken, {
                fields: 'id,name,account_status,currency,timezone_name',
            }),
        ]);
        const pages = (pagesResponse.data ?? []).map((page) => ({
            id: page.id,
            name: page.name,
            category: page.category,
            selected: false,
            accessToken: page.access_token,
            connectedInstagram: page.connected_instagram_account
                ? { id: page.connected_instagram_account.id, name: page.connected_instagram_account.username }
                : undefined,
        }));
        const instagramProfiles = pages
            .filter((page) => page.connectedInstagram)
            .map((page) => ({
            id: page.connectedInstagram.id,
            name: page.connectedInstagram.name,
            selected: false,
            pageId: page.id,
        }));
        const adAccounts = (adAccountsResponse.data ?? []).map((account) => ({
            id: account.id,
            name: account.name,
            selected: false,
            accountStatus: account.account_status,
            currency: account.currency,
            timezoneName: account.timezone_name,
        }));
        await this.syncDiscoveredAssets(integration.id, pages, instagramProfiles, adAccounts);
        return this.getAssets(integration.id, organizationId);
    }
    async getAssets(integrationId, organizationId) {
        await this.accessor.requireIntegration(integrationId, organizationId);
        const accounts = await this.accounts.find({ where: { integrationId }, order: { externalName: 'ASC' } });
        const pages = accounts
            .filter((account) => account.accountType === integration_account_type_enum_1.IntegrationAccountType.PAGE)
            .map((account) => ({
            recordId: account.id,
            id: account.externalId,
            name: account.externalName,
            selected: Boolean(account.metadata?.selected),
            category: typeof account.metadata?.category === 'string' ? account.metadata.category : undefined,
        }));
        const instagramProfiles = accounts
            .filter((account) => account.accountType === integration_account_type_enum_1.IntegrationAccountType.PROFILE)
            .map((account) => ({
            recordId: account.id,
            id: account.externalId,
            name: account.externalName,
            selected: Boolean(account.metadata?.selected),
            pageId: typeof account.metadata?.pageId === 'string' ? account.metadata.pageId : undefined,
        }));
        const adAccounts = accounts
            .filter((account) => account.accountType === integration_account_type_enum_1.IntegrationAccountType.AD_ACCOUNT)
            .map((account) => ({
            recordId: account.id,
            id: account.externalId,
            name: account.externalName,
            selected: Boolean(account.metadata?.selected),
            accountStatus: typeof account.metadata?.accountStatus === 'number' ? account.metadata.accountStatus : undefined,
            currency: typeof account.metadata?.currency === 'string' ? account.metadata.currency : undefined,
            timezoneName: typeof account.metadata?.timezoneName === 'string' ? account.metadata.timezoneName : undefined,
            clientId: typeof account.metadata?.clientId === 'string' ? account.metadata.clientId : undefined,
        }));
        return { pages, instagramProfiles, adAccounts };
    }
    async saveSelectedAssets(integrationId, organizationId, selection) {
        const integration = await this.accessor.requireIntegration(integrationId, organizationId);
        const accounts = await this.accounts.find({ where: { integrationId } });
        const selectedPageIds = new Set(selection.pageIds ?? []);
        const selectedProfileIds = new Set(selection.instagramProfileIds ?? []);
        const selectedAdAccountIds = new Set(selection.adAccountIds ?? []);
        this.validateAssetSelection(accounts, integration_account_type_enum_1.IntegrationAccountType.PAGE, selectedPageIds, 'pagina');
        this.validateAssetSelection(accounts, integration_account_type_enum_1.IntegrationAccountType.PROFILE, selectedProfileIds, 'perfil de Instagram');
        this.validateAssetSelection(accounts, integration_account_type_enum_1.IntegrationAccountType.AD_ACCOUNT, selectedAdAccountIds, 'cuenta publicitaria');
        this.validatePrimary(selection.primaryPageId, selectedPageIds, 'pagina principal');
        this.validatePrimary(selection.primaryInstagramProfileId, selectedProfileIds, 'perfil principal');
        this.validatePrimary(selection.primaryAdAccountId, selectedAdAccountIds, 'cuenta publicitaria principal');
        const selectedPages = accounts.filter((account) => account.accountType === integration_account_type_enum_1.IntegrationAccountType.PAGE && selectedPageIds.has(account.externalId));
        await this.assertPagesAreExclusive(selectedPages, integrationId, organizationId);
        const deselectedPages = accounts.filter((account) => account.accountType === integration_account_type_enum_1.IntegrationAccountType.PAGE && Boolean(account.metadata?.selected) && !selectedPageIds.has(account.externalId));
        await this.subscribeSelectedPages(selectedPages);
        await this.unsubscribePages(deselectedPages);
        for (const account of accounts) {
            if (account.accountType === integration_account_type_enum_1.IntegrationAccountType.PAGE) {
                account.metadata = { ...account.metadata, selected: selectedPageIds.has(account.externalId) };
            }
            if (account.accountType === integration_account_type_enum_1.IntegrationAccountType.PROFILE) {
                account.metadata = { ...account.metadata, selected: selectedProfileIds.has(account.externalId) };
            }
            if (account.accountType === integration_account_type_enum_1.IntegrationAccountType.AD_ACCOUNT) {
                account.metadata = { ...account.metadata, selected: selectedAdAccountIds.has(account.externalId) };
            }
        }
        await this.accounts.save(accounts);
        integration.config = {
            ...integration.config,
            selectedPageIds: [...selectedPageIds],
            selectedInstagramProfileIds: [...selectedProfileIds],
            selectedAdAccountIds: [...selectedAdAccountIds],
            primaryPageId: selection.primaryPageId ?? [...selectedPageIds][0] ?? null,
            primaryInstagramProfileId: selection.primaryInstagramProfileId ?? [...selectedProfileIds][0] ?? null,
            primaryAdAccountId: selection.primaryAdAccountId ?? [...selectedAdAccountIds][0] ?? null,
        };
        integration.lastSyncAt = new Date();
        await this.integrations.save(integration);
        return { saved: true, assets: await this.getAssets(integrationId, organizationId) };
    }
    async subscribeSelectedPages(pages) {
        const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
        const subscribedFields = [
            'leadgen',
            'messages',
            'messaging_postbacks',
            'message_deliveries',
            'message_reads',
        ].join(',');
        await Promise.all(pages.map(async (page) => {
            const accessToken = (0, integration_secrets_1.revealSecret)(page.accessToken);
            if (!accessToken)
                throw new common_1.BadRequestException(`La pagina ${page.externalName} no tiene un token valido; vuelve a descubrir los activos`);
            const body = new URLSearchParams({ subscribed_fields: subscribedFields });
            const response = await fetch(`https://graph.facebook.com/${version}/${page.externalId}/subscribed_apps`, {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${accessToken}`,
                    'content-type': 'application/x-www-form-urlencoded',
                },
                body: body.toString(),
                signal: AbortSignal.timeout(15000),
            });
            if (!response.ok)
                throw new common_1.BadRequestException(`Meta subscription failed for page ${page.externalId}`);
        }));
    }
    async unsubscribePages(pages) {
        const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
        await Promise.all(pages.map(async (page) => {
            const accessToken = (0, integration_secrets_1.revealSecret)(page.accessToken);
            if (!accessToken)
                return;
            const response = await fetch(`https://graph.facebook.com/${version}/${page.externalId}/subscribed_apps`, {
                method: 'DELETE',
                headers: { authorization: `Bearer ${accessToken}` },
                signal: AbortSignal.timeout(15000),
            });
            if (!response.ok)
                throw new common_1.BadRequestException(`No se pudo desuscribir la pagina ${page.externalName}`);
        }));
    }
    async fetchGraph(version, path, accessToken, params) {
        const query = new URLSearchParams(params).toString();
        const response = await fetch(`https://graph.facebook.com/${version}${path}?${query}`, {
            headers: { authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(15000),
        });
        const data = await response.json();
        if (!response.ok)
            throw new common_1.BadRequestException('Meta asset discovery failed');
        return data;
    }
    async syncDiscoveredAssets(integrationId, pages, instagramProfiles, adAccounts) {
        const existing = await this.accounts.find({ where: { integrationId } });
        const byKey = new Map(existing.map((account) => [`${account.accountType}:${account.externalId}`, account]));
        for (const page of pages) {
            const key = `${integration_account_type_enum_1.IntegrationAccountType.PAGE}:${page.id}`;
            const record = byKey.get(key) ?? this.accounts.create({ integrationId, accountType: integration_account_type_enum_1.IntegrationAccountType.PAGE, externalId: page.id, externalName: page.name });
            record.externalName = page.name;
            record.accessToken = page.accessToken ? (0, integration_secrets_1.protectSecret)(page.accessToken) : record.accessToken;
            record.metadata = {
                ...record.metadata,
                category: page.category,
                selected: Boolean(record.metadata?.selected),
            };
            await this.accounts.save(record);
        }
        for (const profile of instagramProfiles) {
            const key = `${integration_account_type_enum_1.IntegrationAccountType.PROFILE}:${profile.id}`;
            const record = byKey.get(key) ?? this.accounts.create({ integrationId, accountType: integration_account_type_enum_1.IntegrationAccountType.PROFILE, externalId: profile.id, externalName: profile.name });
            record.externalName = profile.name;
            record.metadata = {
                ...record.metadata,
                pageId: profile.pageId,
                selected: Boolean(record.metadata?.selected),
            };
            await this.accounts.save(record);
        }
        for (const adAccount of adAccounts) {
            const key = `${integration_account_type_enum_1.IntegrationAccountType.AD_ACCOUNT}:${adAccount.id}`;
            const record = byKey.get(key) ?? this.accounts.create({ integrationId, accountType: integration_account_type_enum_1.IntegrationAccountType.AD_ACCOUNT, externalId: adAccount.id, externalName: adAccount.name });
            record.externalName = adAccount.name;
            record.metadata = {
                ...record.metadata,
                accountStatus: adAccount.accountStatus,
                currency: adAccount.currency,
                timezoneName: adAccount.timezoneName,
                selected: Boolean(record.metadata?.selected),
            };
            await this.accounts.save(record);
        }
    }
    validateAssetSelection(accounts, type, selectedIds, label) {
        const available = new Set(accounts.filter((account) => account.accountType === type).map((account) => account.externalId));
        const unknown = [...selectedIds].find((id) => !available.has(id));
        if (unknown)
            throw new common_1.BadRequestException(`La ${label} ${unknown} no pertenece a esta integracion`);
    }
    validatePrimary(primaryId, selectedIds, label) {
        if (primaryId && !selectedIds.has(primaryId))
            throw new common_1.BadRequestException(`La ${label} debe estar seleccionada`);
    }
    async assertPagesAreExclusive(selectedPages, integrationId, organizationId) {
        for (const page of selectedPages) {
            const matches = await this.accounts.find({
                where: { accountType: integration_account_type_enum_1.IntegrationAccountType.PAGE, externalId: page.externalId },
                relations: { integration: true },
            });
            const conflict = matches.find((candidate) => candidate.integrationId !== integrationId &&
                candidate.integration.organizationId !== organizationId &&
                Boolean(candidate.metadata?.selected));
            if (conflict) {
                throw new common_1.ConflictException(`La pagina ${page.externalName} ya esta activa en otra organizacion`);
            }
        }
    }
};
exports.MetaAssetDiscoveryService = MetaAssetDiscoveryService;
exports.MetaAssetDiscoveryService = MetaAssetDiscoveryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(integration_entity_1.Integration)),
    __param(1, (0, typeorm_1.InjectRepository)(integration_account_entity_1.IntegrationAccount)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        meta_integration_accessor_service_1.MetaIntegrationAccessor])
], MetaAssetDiscoveryService);
//# sourceMappingURL=meta-asset-discovery.service.js.map