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
exports.PodsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const client_entity_1 = require("../clients/client.entity");
const user_entity_1 = require("../users/user.entity");
const account_access_service_1 = require("../../core/client-scope/account-access.service");
const pod_member_entity_1 = require("./pod-member.entity");
const pod_entity_1 = require("./pod.entity");
let PodsService = class PodsService {
    constructor(pods, members, users, clients, accountAccess) {
        this.pods = pods;
        this.members = members;
        this.users = users;
        this.clients = clients;
        this.accountAccess = accountAccess;
    }
    async list(organizationId) {
        const pods = await this.pods.find({ where: { organizationId }, order: { name: 'ASC' } });
        if (pods.length === 0)
            return [];
        const podIds = pods.map((pod) => pod.id);
        const memberRecords = await this.members.find({ where: { podId: (0, typeorm_2.In)(podIds) } });
        const memberIds = [...new Set(memberRecords.map((item) => item.userId))];
        const [podUsers, podClients] = await Promise.all([
            memberIds.length ? this.users.find({ where: { organizationId, id: (0, typeorm_2.In)(memberIds) }, order: { name: 'ASC' } }) : Promise.resolve([]),
            this.clients.find({ where: { organizationId, podId: (0, typeorm_2.In)(podIds) }, order: { name: 'ASC' } }),
        ]);
        const usersById = new Map(podUsers.map((user) => [user.id, user]));
        const memberIdsByPod = new Map();
        for (const record of memberRecords) {
            const current = memberIdsByPod.get(record.podId);
            if (current)
                current.push(record.userId);
            else
                memberIdsByPod.set(record.podId, [record.userId]);
        }
        const clientsByPod = new Map();
        for (const client of podClients) {
            if (!client.podId)
                continue;
            const current = clientsByPod.get(client.podId);
            if (current)
                current.push(client);
            else
                clientsByPod.set(client.podId, [client]);
        }
        return pods.map((pod) => ({
            ...pod,
            members: (memberIdsByPod.get(pod.id) ?? [])
                .map((userId) => usersById.get(userId))
                .filter((user) => user !== undefined)
                .map(({ id, name, role, workMode }) => ({ id, name, role, workMode })),
            clients: (clientsByPod.get(pod.id) ?? []).map(({ id, name, status, defaultUdBudget }) => ({ id, name, status, defaultUdBudget })),
        }));
    }
    async create(organizationId, dto) {
        await this.validateLeader(dto.leaderId, organizationId);
        const duplicate = await this.pods.findOne({ where: { organizationId, name: dto.name.trim() } });
        if (duplicate)
            throw new common_1.BadRequestException('Ya existe un pod con este nombre');
        return this.pods.save(this.pods.create({ ...dto, organizationId, name: dto.name.trim(), description: dto.description?.trim() || undefined }));
    }
    async update(id, organizationId, dto) {
        const pod = await this.find(id, organizationId);
        await this.validateLeader(dto.leaderId, organizationId);
        Object.assign(pod, dto);
        if (dto.name !== undefined)
            pod.name = dto.name.trim();
        if (dto.description !== undefined)
            pod.description = dto.description.trim() || undefined;
        return this.pods.save(pod);
    }
    async setMembers(id, organizationId, userIds) {
        const pod = await this.find(id, organizationId);
        const uniqueIds = [...new Set(userIds)];
        if (uniqueIds.length) {
            const users = await this.users.find({ where: { organizationId, id: (0, typeorm_2.In)(uniqueIds), isActive: true } });
            if (users.length !== uniqueIds.length || users.some((user) => user.role === 'client'))
                throw new common_1.BadRequestException('Todos los integrantes deben ser usuarios internos activos');
        }
        await this.members.manager.transaction(async (manager) => {
            await manager.delete(pod_member_entity_1.PodMember, { podId: pod.id });
            if (uniqueIds.length)
                await manager.save(pod_member_entity_1.PodMember, uniqueIds.map((userId) => manager.create(pod_member_entity_1.PodMember, { podId: pod.id, userId })));
        });
        this.accountAccess.invalidateAll();
        return this.list(organizationId);
    }
    async setClients(id, organizationId, clientIds) {
        const pod = await this.find(id, organizationId);
        const uniqueIds = [...new Set(clientIds)];
        if (uniqueIds.length) {
            const clients = await this.clients.find({ where: { organizationId, id: (0, typeorm_2.In)(uniqueIds) } });
            if (clients.length !== uniqueIds.length)
                throw new common_1.BadRequestException('Una o más cuentas no pertenecen a la organización');
        }
        await this.clients.manager.transaction(async (manager) => {
            await manager.createQueryBuilder().update(client_entity_1.Client).set({ podId: undefined }).where('organization_id = :organizationId AND pod_id = :podId', { organizationId, podId: pod.id }).execute();
            if (uniqueIds.length)
                await manager.createQueryBuilder().update(client_entity_1.Client).set({ podId: pod.id }).where('organization_id = :organizationId AND id IN (:...ids)', { organizationId, ids: uniqueIds }).execute();
        });
        this.accountAccess.invalidateAll();
        return this.list(organizationId);
    }
    async remove(id, organizationId) {
        const pod = await this.find(id, organizationId);
        pod.status = 'archived';
        await this.pods.save(pod);
        return { archived: true };
    }
    async find(id, organizationId) {
        const pod = await this.pods.findOne({ where: { id, organizationId } });
        if (!pod)
            throw new common_1.NotFoundException('Pod no encontrado');
        return pod;
    }
    async validateLeader(leaderId, organizationId) {
        if (!leaderId)
            return;
        const leader = await this.users.findOne({ where: { id: leaderId, organizationId, isActive: true } });
        if (!leader || leader.role === 'client')
            throw new common_1.BadRequestException('El líder debe ser un usuario interno activo');
    }
};
exports.PodsService = PodsService;
exports.PodsService = PodsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(pod_entity_1.Pod)),
    __param(1, (0, typeorm_1.InjectRepository)(pod_member_entity_1.PodMember)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        account_access_service_1.AccountAccessService])
], PodsService);
