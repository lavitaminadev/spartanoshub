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
var AccountAccessService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountAccessService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const client_entity_1 = require("../../modules/clients/client.entity");
const pod_member_entity_1 = require("../../modules/pods/pod-member.entity");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const user_client_access_entity_1 = require("./user-client-access.entity");
const UNRESTRICTED_ROLES = new Set([
    user_role_enum_1.UserRole.ADMIN,
    user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR,
    user_role_enum_1.UserRole.OPERATIONS_DIRECTOR,
    user_role_enum_1.UserRole.CREATIVE_DIRECTOR,
    user_role_enum_1.UserRole.ART_DIRECTOR,
    user_role_enum_1.UserRole.AV_DIRECTOR,
]);
let AccountAccessService = AccountAccessService_1 = class AccountAccessService {
    constructor(clients, podMembers, assignments) {
        this.clients = clients;
        this.podMembers = podMembers;
        this.assignments = assignments;
        this.cache = new Map();
    }
    async allowedClientIds(organizationId, user) {
        if (UNRESTRICTED_ROLES.has(user.role))
            return undefined;
        if (user.role === user_role_enum_1.UserRole.CLIENT)
            return user.clientId ? [user.clientId] : [];
        const cacheKey = `${organizationId}:${user.id}`;
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now())
            return cached.clientIds;
        const reasons = await this.resolve(organizationId, user.id);
        const clientIds = [...new Set(reasons.map((item) => item.clientId))];
        this.cache.set(cacheKey, { clientIds, expiresAt: Date.now() + AccountAccessService_1.CACHE_TTL_MS });
        return clientIds;
    }
    async assertClient(organizationId, user, clientId) {
        if (!clientId)
            return;
        const client = await this.clients.findOne({ where: { id: clientId, organizationId }, select: { id: true } });
        if (!client)
            throw new common_1.NotFoundException('Client not found');
        const allowed = await this.allowedClientIds(organizationId, user);
        if (allowed === undefined)
            return;
        if (!allowed.includes(client.id))
            throw new common_1.NotFoundException('Client not found');
    }
    async explain(organizationId, user) {
        if (UNRESTRICTED_ROLES.has(user.role))
            return 'unrestricted';
        if (user.role === user_role_enum_1.UserRole.CLIENT) {
            return user.clientId ? [{ clientId: user.clientId, source: 'assignment' }] : [];
        }
        return this.resolve(organizationId, user.id);
    }
    invalidateUser(userId) {
        for (const key of this.cache.keys()) {
            if (key.endsWith(`:${userId}`))
                this.cache.delete(key);
        }
    }
    invalidateAll() {
        this.cache.clear();
    }
    async resolve(organizationId, userId) {
        const memberships = await this.podMembers.find({ where: { userId }, select: { podId: true } });
        const podIds = memberships.map((item) => item.podId);
        const [podClients, assignments, managed] = await Promise.all([
            podIds.length
                ? this.clients.find({ where: { organizationId, podId: (0, typeorm_2.In)(podIds) }, select: { id: true } })
                : Promise.resolve([]),
            this.assignments.find({ where: { organizationId, userId }, select: { clientId: true } }),
            this.clients.find({ where: { organizationId, communityManagerId: userId }, select: { id: true } }),
        ]);
        return [
            ...podClients.map((client) => ({ clientId: client.id, source: 'pod' })),
            ...assignments.map((item) => ({ clientId: item.clientId, source: 'assignment' })),
            ...managed.map((client) => ({ clientId: client.id, source: 'community-manager' })),
        ];
    }
};
exports.AccountAccessService = AccountAccessService;
AccountAccessService.CACHE_TTL_MS = 30_000;
exports.AccountAccessService = AccountAccessService = AccountAccessService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(1, (0, typeorm_1.InjectRepository)(pod_member_entity_1.PodMember)),
    __param(2, (0, typeorm_1.InjectRepository)(user_client_access_entity_1.UserClientAccess)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AccountAccessService);
