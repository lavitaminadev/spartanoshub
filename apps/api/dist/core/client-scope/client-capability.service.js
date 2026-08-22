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
var ClientCapabilityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientCapabilityService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const client_entity_1 = require("../../modules/clients/client.entity");
const client_capabilities_1 = require("../../modules/clients/client-capabilities");
const NOMBRE = {
    crm: 'CRM',
    reservations: 'reservas',
    metaConversions: 'conversiones de Meta',
    googleConversions: 'conversiones de Google',
    budgetVisibility: 'visibilidad de presupuesto',
};
let ClientCapabilityService = ClientCapabilityService_1 = class ClientCapabilityService {
    constructor(clients) {
        this.clients = clients;
        this.cache = new Map();
    }
    async assert(organizationId, clientId, capacidad) {
        if (!clientId)
            return;
        if (await this.tiene(organizationId, clientId, capacidad))
            return;
        throw new common_1.ForbiddenException(`Esta empresa no tiene ${NOMBRE[capacidad] ?? capacidad} entre sus servicios contratados`);
    }
    async tiene(organizationId, clientId, capacidad) {
        const clave = `${organizationId}:${clientId}`;
        const enCache = this.cache.get(clave);
        if (enCache && enCache.expiresAt > Date.now())
            return enCache.capacidades.has(capacidad);
        const client = await this.clients.findOne({
            where: { id: clientId, organizationId },
            select: { id: true, capabilities: true },
        });
        const capacidades = new Set(Object.entries((0, client_capabilities_1.normalizeClientCapabilities)(client?.capabilities))
            .filter(([, activa]) => activa)
            .map(([nombre]) => nombre));
        this.cache.set(clave, { capacidades, expiresAt: Date.now() + ClientCapabilityService_1.CACHE_TTL_MS });
        return capacidades.has(capacidad);
    }
    async filtrar(organizationId, clientIds, capacidad) {
        const empresas = await this.clients.find({
            where: clientIds === undefined
                ? { organizationId }
                : { organizationId, id: (0, typeorm_2.In)(clientIds.length ? clientIds : ['']) },
            select: { id: true, capabilities: true },
        });
        return empresas
            .filter((empresa) => (0, client_capabilities_1.normalizeClientCapabilities)(empresa.capabilities)[capacidad])
            .map((empresa) => empresa.id);
    }
};
exports.ClientCapabilityService = ClientCapabilityService;
ClientCapabilityService.CACHE_TTL_MS = 30_000;
exports.ClientCapabilityService = ClientCapabilityService = ClientCapabilityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ClientCapabilityService);
