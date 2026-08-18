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
exports.TasksService = exports.TASK_ENTITY_TYPES = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const approval_request_entity_1 = require("./approval-request.entity");
const approval_request_status_enum_1 = require("./approval-request-status.enum");
const user_entity_1 = require("../users/user.entity");
exports.TASK_ENTITY_TYPES = ['lead', 'opportunity', 'piece', 'session', 'work_request'];
let TasksService = class TasksService {
    constructor(repo, users) {
        this.repo = repo;
        this.users = users;
    }
    async create(organizationId, requestedBy, dto) {
        if (!exports.TASK_ENTITY_TYPES.includes(dto.entityType)) {
            throw new common_1.BadRequestException(`No se pueden crear tareas sobre un registro de tipo "${dto.entityType}"`);
        }
        if (dto.assignedTo)
            await this.assertActiveUser(organizationId, dto.assignedTo);
        return this.repo.save(this.repo.create({
            organizationId,
            kind: approval_request_status_enum_1.PendingKind.TASK,
            title: dto.title.trim(),
            description: dto.description?.trim() || undefined,
            entityType: dto.entityType,
            entityId: dto.entityId,
            clientId: dto.clientId,
            assignedTo: dto.assignedTo,
            dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
            requestedBy,
            status: approval_request_status_enum_1.ApprovalRequestStatus.PENDING,
        }));
    }
    async listForEntity(organizationId, entityType, entityId) {
        const tasks = await this.repo.find({
            where: { organizationId, kind: approval_request_status_enum_1.PendingKind.TASK, entityType, entityId },
            order: { dueAt: 'ASC', createdAt: 'DESC' },
            take: 100,
        });
        return [
            ...tasks.filter((task) => this.isOpen(task)),
            ...tasks.filter((task) => !this.isOpen(task)),
        ];
    }
    listMine(organizationId, userId, limit = 50) {
        return this.repo.find({
            where: {
                organizationId,
                kind: approval_request_status_enum_1.PendingKind.TASK,
                assignedTo: userId,
                status: (0, typeorm_2.In)([...approval_request_status_enum_1.OPEN_STATUSES]),
            },
            order: { dueAt: 'ASC' },
            take: Math.min(Math.max(limit, 1), 200),
        });
    }
    async update(organizationId, id, dto) {
        const task = await this.repo.findOne({ where: { id, organizationId, kind: approval_request_status_enum_1.PendingKind.TASK } });
        if (!task)
            throw new common_1.NotFoundException('Tarea no encontrada');
        if (dto.status) {
            const permitidos = [
                approval_request_status_enum_1.ApprovalRequestStatus.PENDING,
                approval_request_status_enum_1.ApprovalRequestStatus.DONE,
                approval_request_status_enum_1.ApprovalRequestStatus.CANCELLED,
            ];
            if (!permitidos.includes(dto.status)) {
                throw new common_1.BadRequestException('Una tarea se completa o se cancela; aprobar y rechazar son de una aprobación');
            }
            task.status = dto.status;
            task.decisionAt = dto.status === approval_request_status_enum_1.ApprovalRequestStatus.PENDING ? undefined : new Date();
        }
        if (dto.assignedTo !== undefined) {
            if (dto.assignedTo)
                await this.assertActiveUser(organizationId, dto.assignedTo);
            task.assignedTo = dto.assignedTo || undefined;
        }
        if (dto.title !== undefined)
            task.title = dto.title.trim();
        if (dto.description !== undefined)
            task.description = dto.description?.trim() || undefined;
        if (dto.dueAt !== undefined)
            task.dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
        if (dto.decisionNotes !== undefined)
            task.decisionNotes = dto.decisionNotes?.trim() || undefined;
        return this.repo.save(task);
    }
    findOverdue(limit) {
        return this.repo.find({
            where: {
                kind: approval_request_status_enum_1.PendingKind.TASK,
                status: (0, typeorm_2.In)([...approval_request_status_enum_1.OPEN_STATUSES]),
                dueAt: (0, typeorm_2.LessThan)(new Date()),
                assignedTo: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()),
            },
            order: { dueAt: 'ASC' },
            take: limit,
        });
    }
    isOpen(task) {
        return approval_request_status_enum_1.OPEN_STATUSES.includes(task.status);
    }
    async assertActiveUser(organizationId, userId) {
        const user = await this.users.findOne({
            where: { id: userId, organizationId, isActive: true },
            select: { id: true },
        });
        if (!user)
            throw new common_1.BadRequestException('La persona indicada no está activa');
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(approval_request_entity_1.ApprovalRequest)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], TasksService);
