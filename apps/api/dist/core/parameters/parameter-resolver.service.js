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
exports.ParameterResolver = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const parameter_definition_entity_1 = require("./parameter-definition.entity");
const parameter_value_entity_1 = require("./parameter-value.entity");
let ParameterResolver = class ParameterResolver {
    constructor(definitionRepo, valueRepo) {
        this.definitionRepo = definitionRepo;
        this.valueRepo = valueRepo;
        this.cache = new Map();
        this.ttlMs = 60_000;
    }
    async get(key, clientId, planId, organizationId) {
        const cacheKey = this.cacheKey(key, clientId, planId, organizationId);
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }
        const value = await this.resolveFromDb(key, clientId, planId, organizationId);
        this.cache.set(cacheKey, { value, expiresAt: Date.now() + this.ttlMs });
        return value;
    }
    async getFresh(key, clientId, planId, organizationId) {
        this.invalidate(key, clientId, planId, organizationId);
        return this.get(key, clientId, planId, organizationId);
    }
    invalidate(key, clientId, planId, organizationId) {
        this.cache.delete(this.cacheKey(key, clientId, planId, organizationId));
    }
    cacheKey(key, clientId, planId, organizationId) {
        return `param:${key}:${clientId ?? 'null'}:${planId ?? 'null'}:${organizationId ?? 'null'}`;
    }
    async getManyForOrganization(keys, organizationId) {
        const resolved = new Map();
        const pendientes = [];
        for (const key of keys) {
            const cached = this.cache.get(this.cacheKey(key, null, null, organizationId));
            if (cached && cached.expiresAt > Date.now())
                resolved.set(key, cached.value);
            else
                pendientes.push(key);
        }
        if (pendientes.length === 0)
            return resolved;
        const definitions = await this.definitionRepo.find({ where: { key: (0, typeorm_2.In)(pendientes) } });
        const byId = new Map(definitions.map((definition) => [definition.id, definition]));
        let values = [];
        if (organizationId && definitions.length) {
            const now = new Date();
            values = await this.valueRepo.find({
                where: [
                    { definitionId: (0, typeorm_2.In)([...byId.keys()]), scopeType: 'organization', scopeId: organizationId, validFrom: (0, typeorm_2.LessThanOrEqual)(now), validTo: (0, typeorm_2.IsNull)() },
                    { definitionId: (0, typeorm_2.In)([...byId.keys()]), scopeType: 'organization', scopeId: organizationId, validFrom: (0, typeorm_2.LessThanOrEqual)(now), validTo: (0, typeorm_2.MoreThanOrEqual)(now) },
                ],
                order: { version: 'DESC' },
            });
        }
        const vigente = new Map();
        for (const value of values) {
            if (!vigente.has(value.definitionId))
                vigente.set(value.definitionId, value.valueJson?.value ?? null);
        }
        for (const key of pendientes) {
            const definition = definitions.find((item) => item.key === key);
            const valor = definition
                ? vigente.get(definition.id) ?? definition.defaultValue?.value ?? null
                : null;
            resolved.set(key, valor);
            this.cache.set(this.cacheKey(key, null, null, organizationId), { value: valor, expiresAt: Date.now() + this.ttlMs });
        }
        return resolved;
    }
    async resolveFromDb(key, clientId, planId, organizationId) {
        const definition = await this.definitionRepo.findOne({ where: { key } });
        if (!definition)
            return null;
        if (clientId) {
            const value = await this.findActiveValue(definition.id, 'client', clientId);
            if (value !== null)
                return value;
        }
        if (planId) {
            const value = await this.findActiveValue(definition.id, 'plan', planId);
            if (value !== null)
                return value;
        }
        if (organizationId) {
            const value = await this.findActiveValue(definition.id, 'organization', organizationId);
            if (value !== null)
                return value;
        }
        return definition.defaultValue?.value ?? null;
    }
    async findActiveValue(definitionId, scopeType, scopeId) {
        const now = new Date();
        const value = await this.valueRepo.findOne({
            where: [
                { definitionId, scopeType, scopeId, validFrom: (0, typeorm_2.LessThanOrEqual)(now), validTo: (0, typeorm_2.IsNull)() },
                { definitionId, scopeType, scopeId, validFrom: (0, typeorm_2.LessThanOrEqual)(now), validTo: (0, typeorm_2.MoreThanOrEqual)(now) },
            ],
            order: { version: 'DESC' },
        });
        return value?.valueJson?.value ?? null;
    }
};
exports.ParameterResolver = ParameterResolver;
exports.ParameterResolver = ParameterResolver = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(parameter_definition_entity_1.ParameterDefinition)),
    __param(1, (0, typeorm_1.InjectRepository)(parameter_value_entity_1.ParameterValue)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ParameterResolver);
