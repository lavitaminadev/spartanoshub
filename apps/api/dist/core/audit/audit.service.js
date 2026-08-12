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
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const audit_entity_1 = require("./audit.entity");
const user_entity_1 = require("../../modules/users/user.entity");
let AuditService = class AuditService {
    constructor(repo) {
        this.repo = repo;
    }
    async log(params) {
        const entry = this.repo.create(params);
        return this.repo.save(entry);
    }
    async findByEntity(entityType, entityId) {
        return this.repo.find({
            where: { entityType, entityId },
            order: { occurredAt: 'DESC' },
            take: 50,
        });
    }
    async search(organizationId, options) {
        const query = this.repo.createQueryBuilder('audit')
            .leftJoin(user_entity_1.User, 'actor', 'actor.id = audit.actor_id')
            .select('audit.id', 'id')
            .addSelect('audit.entity_type', 'entityType')
            .addSelect('audit.entity_id', 'entityId')
            .addSelect('audit.action', 'action')
            .addSelect('audit.before', 'before')
            .addSelect('audit.after', 'after')
            .addSelect('audit.reason', 'reason')
            .addSelect('audit.ip_address', 'ipAddress')
            .addSelect('audit.occurred_at', 'occurredAt')
            .addSelect('audit.actor_id', 'actorId')
            .addSelect('actor.name', 'actorName')
            .addSelect('actor.email', 'actorEmail')
            .where('audit.organization_id = :organizationId', { organizationId })
            .orderBy('audit.occurred_at', 'DESC')
            .limit(Math.min(Math.max(options.limit ?? 100, 1), 500));
        if (options.entityType)
            query.andWhere('audit.entity_type = :entityType', { entityType: options.entityType });
        if (options.entityId)
            query.andWhere('audit.entity_id = :entityId', { entityId: options.entityId });
        if (options.action)
            query.andWhere('audit.action = :action', { action: options.action });
        if (options.actorId)
            query.andWhere('audit.actor_id = :actorId', { actorId: options.actorId });
        return query.getRawMany();
    }
    async findByOrganization(organizationId, limit = 100) {
        return this.repo.find({
            where: { organizationId },
            order: { occurredAt: 'DESC' },
            take: limit,
        });
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(audit_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AuditService);
