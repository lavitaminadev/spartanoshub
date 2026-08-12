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
exports.AudiovisualService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const moodboard_entity_1 = require("./moodboard.entity");
const session_entity_1 = require("./session.entity");
const client_entity_1 = require("../clients/client.entity");
const user_entity_1 = require("../users/user.entity");
let AudiovisualService = class AudiovisualService {
    constructor(moodboardRepo, sessionRepo, clients, users) {
        this.moodboardRepo = moodboardRepo;
        this.sessionRepo = sessionRepo;
        this.clients = clients;
        this.users = users;
    }
    async createMoodboard(dto, organizationId, createdBy) {
        await this.validateClient(dto.clientId, organizationId);
        const entity = this.moodboardRepo.create({
            ...dto,
            organizationId,
            createdBy,
            title: dto.title.trim(),
            description: dto.description?.trim() || undefined,
        });
        return this.moodboardRepo.save(entity);
    }
    async findAllMoodboards(organizationId, limit = 50, offset = 0) {
        const [data, total] = await this.moodboardRepo.findAndCount({
            where: { organizationId },
            order: { createdAt: 'DESC' },
            relations: { client: true },
            take: limit,
            skip: offset,
        });
        return { data, total, limit, offset };
    }
    async findOneMoodboard(id, organizationId) {
        const entity = await this.moodboardRepo.findOne({ where: { id, organizationId } });
        if (!entity)
            throw new common_1.NotFoundException('Moodboard not found');
        return entity;
    }
    async updateMoodboard(id, dto, organizationId) {
        const entity = await this.findOneMoodboard(id, organizationId);
        await this.validateUsers(dto.verifiedBy ? [dto.verifiedBy] : [], organizationId);
        Object.assign(entity, dto);
        if (dto.title !== undefined)
            entity.title = dto.title.trim();
        if (dto.description !== undefined)
            entity.description = dto.description.trim() || undefined;
        return this.moodboardRepo.save(entity);
    }
    async removeMoodboard(id, organizationId) {
        const entity = await this.findOneMoodboard(id, organizationId);
        return this.moodboardRepo.remove(entity);
    }
    async createSession(dto, organizationId) {
        await this.validateSessionReferences(dto.clientId, dto.moodboardId, dto.assignedTeam, organizationId);
        const entity = this.sessionRepo.create({
            ...dto,
            organizationId,
            date: new Date(dto.date),
            location: dto.location?.trim() || undefined,
        });
        return this.sessionRepo.save(entity);
    }
    async findAllSessions(organizationId, limit = 50, offset = 0, assignedTo) {
        const query = this.sessionRepo.createQueryBuilder('session')
            .leftJoinAndSelect('session.client', 'client')
            .where('session.organization_id = :organizationId', { organizationId })
            .orderBy('session.date', 'DESC')
            .take(limit)
            .skip(offset);
        if (assignedTo)
            query.andWhere('JSON_CONTAINS(session.assigned_team, :assignedTo)', { assignedTo: JSON.stringify(assignedTo) });
        const [data, total] = await query.getManyAndCount();
        return { data, total, limit, offset };
    }
    async findOneSession(id, organizationId) {
        const entity = await this.sessionRepo.findOne({ where: { id, organizationId } });
        if (!entity)
            throw new common_1.NotFoundException('Session not found');
        return entity;
    }
    async updateSession(id, dto, organizationId) {
        const entity = await this.findOneSession(id, organizationId);
        await this.validateSessionReferences(entity.clientId, dto.moodboardId ?? entity.moodboardId, dto.assignedTeam, organizationId);
        Object.assign(entity, dto);
        if (dto.date !== undefined)
            entity.date = new Date(dto.date);
        if (dto.location !== undefined)
            entity.location = dto.location.trim() || undefined;
        return this.sessionRepo.save(entity);
    }
    async removeSession(id, organizationId) {
        const entity = await this.findOneSession(id, organizationId);
        return this.sessionRepo.remove(entity);
    }
    async validateClient(clientId, organizationId) {
        const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
        if (!client)
            throw new common_1.BadRequestException('El cliente no pertenece a esta organizacion');
    }
    async validateUsers(userIds = [], organizationId) {
        if (!userIds.length)
            return;
        const uniqueIds = [...new Set(userIds)];
        const count = await this.users.createQueryBuilder('user')
            .where('user.organization_id = :organizationId AND user.is_active = 1', { organizationId })
            .andWhere('user.id IN (:...userIds)', { userIds: uniqueIds })
            .getCount();
        if (count !== uniqueIds.length)
            throw new common_1.BadRequestException('El equipo asignado contiene usuarios invalidos');
    }
    async validateSessionReferences(clientId, moodboardId, assignedTeam, organizationId) {
        await Promise.all([this.validateClient(clientId, organizationId), this.validateUsers(assignedTeam, organizationId)]);
        if (!moodboardId)
            return;
        const moodboard = await this.moodboardRepo.findOne({ where: { id: moodboardId, organizationId, clientId } });
        if (!moodboard)
            throw new common_1.BadRequestException('El moodboard no pertenece al cliente seleccionado');
    }
};
exports.AudiovisualService = AudiovisualService;
exports.AudiovisualService = AudiovisualService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(moodboard_entity_1.Moodboard)),
    __param(1, (0, typeorm_1.InjectRepository)(session_entity_1.Session)),
    __param(2, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AudiovisualService);
//# sourceMappingURL=audiovisual.service.js.map