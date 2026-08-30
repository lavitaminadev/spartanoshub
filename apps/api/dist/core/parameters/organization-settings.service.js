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
exports.OrganizationSettingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const audit_service_1 = require("../audit/audit.service");
const parameter_definition_entity_1 = require("./parameter-definition.entity");
const parameter_resolver_service_1 = require("./parameter-resolver.service");
const parameter_value_entity_1 = require("./parameter-value.entity");
const organization_settings_catalog_1 = require("./organization-settings.catalog");
let OrganizationSettingsService = class OrganizationSettingsService {
    constructor(definitionRepo, valueRepo, dataSource, audit, resolver) {
        this.definitionRepo = definitionRepo;
        this.valueRepo = valueRepo;
        this.dataSource = dataSource;
        this.audit = audit;
        this.resolver = resolver;
    }
    async list(organizationId, clientId) {
        const definitions = await this.ensureDefinitions();
        const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));
        const idsDeDefinicion = definitions.map((definition) => definition.id);
        const deLaOrganizacion = await this.valueRepo.find({
            where: {
                definitionId: (0, typeorm_2.In)(idsDeDefinicion),
                scopeType: 'organization',
                scopeId: organizationId,
                validTo: (0, typeorm_2.IsNull)(),
            },
        });
        const valueByDefinition = new Map(deLaOrganizacion.map((value) => [value.definitionId, value]));
        const deLaEmpresa = clientId
            ? await this.valueRepo.find({
                where: {
                    definitionId: (0, typeorm_2.In)(idsDeDefinicion),
                    scopeType: 'client',
                    scopeId: clientId,
                    validTo: (0, typeorm_2.IsNull)(),
                },
            })
            : [];
        const propios = new Set(deLaEmpresa.map((value) => value.definitionId));
        for (const value of deLaEmpresa)
            valueByDefinition.set(value.definitionId, value);
        return organization_settings_catalog_1.ORGANIZATION_SETTINGS.map((setting) => {
            const definition = definitionByKey.get(setting.key);
            const override = valueByDefinition.get(definition.id);
            return {
                ...setting,
                level: (0, organization_settings_catalog_1.settingLevel)(setting.key),
                value: override?.valueJson?.value ?? setting.defaultValue,
                source: override
                    ? (propios.has(definition.id) ? 'client' : 'organization')
                    : 'master_default',
                version: override?.version ?? 0,
            };
        });
    }
    async update(organizationId, actorId, requestedValues, clientId) {
        const catalogByKey = new Map(organization_settings_catalog_1.ORGANIZATION_SETTINGS.map((setting) => [setting.key, setting]));
        const normalizedValues = new Map();
        for (const [key, value] of Object.entries(requestedValues)) {
            const setting = catalogByKey.get(key);
            if (!setting)
                throw new common_1.BadRequestException(`La configuración "${key}" no existe`);
            try {
                normalizedValues.set(key, (0, organization_settings_catalog_1.validateOrganizationSettingValue)(setting, value));
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'no es válida';
                throw new common_1.BadRequestException(`${setting.label}: ${message}`);
            }
        }
        const definitions = await this.ensureDefinitions();
        const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));
        const before = {};
        const after = {};
        await this.dataSource.transaction(async (manager) => {
            const valueRepo = manager.getRepository(parameter_value_entity_1.ParameterValue);
            const now = new Date();
            for (const [key, value] of normalizedValues) {
                const definition = definitionByKey.get(key);
                const active = await valueRepo.findOne({
                    where: {
                        definitionId: definition.id,
                        scopeType: clientId ? 'client' : 'organization',
                        scopeId: clientId ?? organizationId,
                        validTo: (0, typeorm_2.IsNull)(),
                    },
                    order: { version: 'DESC' },
                });
                const previous = active?.valueJson?.value ?? definition.defaultValue?.value ?? null;
                if (JSON.stringify(previous) === JSON.stringify(value))
                    continue;
                if (active) {
                    active.validTo = now;
                    await valueRepo.save(active);
                }
                await valueRepo.save(valueRepo.create({
                    definitionId: definition.id,
                    scopeType: clientId ? 'client' : 'organization',
                    scopeId: clientId ?? organizationId,
                    valueJson: { value },
                    version: (active?.version ?? 0) + 1,
                    validFrom: now,
                }));
                before[key] = previous;
                after[key] = value;
            }
        });
        if (Object.keys(after).length > 0) {
            await this.audit.log({
                organizationId,
                actorId,
                entityType: 'organization_settings',
                entityId: organizationId,
                action: 'update',
                before,
                after,
                reason: clientId
                    ? `Actualización desde Configuración Central para la empresa ${clientId}`
                    : 'Actualización desde Configuración Central',
            });
            for (const key of Object.keys(after))
                this.resolver.invalidate(key, clientId ?? null, null, organizationId);
        }
        return this.list(organizationId);
    }
    async ensureDefinitions() {
        const keys = organization_settings_catalog_1.ORGANIZATION_SETTINGS.map((setting) => setting.key);
        const existing = await this.definitionRepo.find({ where: { key: (0, typeorm_2.In)(keys) } });
        const existingKeys = new Set(existing.map((definition) => definition.key));
        const missing = organization_settings_catalog_1.ORGANIZATION_SETTINGS.filter((setting) => !existingKeys.has(setting.key));
        if (missing.length > 0) {
            await this.definitionRepo.createQueryBuilder()
                .insert()
                .values(missing.map((setting) => ({
                key: setting.key,
                description: setting.description,
                defaultValue: { value: setting.defaultValue },
            })))
                .orIgnore()
                .execute();
        }
        return this.definitionRepo.find({ where: { key: (0, typeorm_2.In)(keys) } });
    }
};
exports.OrganizationSettingsService = OrganizationSettingsService;
exports.OrganizationSettingsService = OrganizationSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(parameter_definition_entity_1.ParameterDefinition)),
    __param(1, (0, typeorm_1.InjectRepository)(parameter_value_entity_1.ParameterValue)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        audit_service_1.AuditService,
        parameter_resolver_service_1.ParameterResolver])
], OrganizationSettingsService);
