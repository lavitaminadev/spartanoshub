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
exports.MeetingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const create_meeting_use_case_1 = require("./create-meeting.use-case");
const list_meetings_use_case_1 = require("./list-meetings.use-case");
const meeting_entity_1 = require("./meeting.entity");
const action_item_entity_1 = require("./action-item.entity");
const create_meeting_dto_1 = require("./dto/create-meeting.dto");
const create_action_item_dto_1 = require("./dto/create-action-item.dto");
const update_action_item_dto_1 = require("./dto/update-action-item.dto");
const meeting_type_enum_1 = require("./meeting-type.enum");
const action_item_status_enum_1 = require("./action-item-status.enum");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const google_calendar_service_1 = require("../integrations/google/google-calendar.service");
const update_meeting_dto_1 = require("./dto/update-meeting.dto");
const client_entity_1 = require("../clients/client.entity");
const user_entity_1 = require("../users/user.entity");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
let MeetingsController = class MeetingsController {
    constructor(repo, actionItemRepo, clientRepo, userRepo, createMeeting, listMeetings, calendar) {
        this.repo = repo;
        this.actionItemRepo = actionItemRepo;
        this.clientRepo = clientRepo;
        this.userRepo = userRepo;
        this.createMeeting = createMeeting;
        this.listMeetings = listMeetings;
        this.calendar = calendar;
    }
    async create(dto, req) {
        await this.assertClientAccess(req, dto.clientId);
        const { notes, ...meetingData } = dto;
        return this.createMeeting.execute({
            ...meetingData,
            organizationId: req.organizationId,
            createdBy: req.user.id,
            type: dto.type || meeting_type_enum_1.MeetingType.WEEKLY,
            scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : new Date(),
            minutes: dto.minutes?.trim() || notes?.trim() || undefined,
        });
    }
    async list(type, req) {
        const clientId = req.user.role === user_role_enum_1.UserRole.CLIENT ? req.user.clientId : undefined;
        if (req.user?.role === user_role_enum_1.UserRole.CLIENT && !clientId)
            throw new common_1.ForbiddenException('Client account is not associated');
        const assignedClientIds = req.user.role === user_role_enum_1.UserRole.COMMUNITY_MANAGER
            ? (await this.clientRepo.find({ select: { id: true }, where: { organizationId: req.organizationId, communityManagerId: req.user.id } })).map((client) => client.id)
            : undefined;
        const meetings = await this.listMeetings.execute(req.organizationId, type, clientId, assignedClientIds);
        if (meetings.length === 0)
            return [];
        const actionItems = await this.actionItemRepo.find({
            where: { meetingId: (0, typeorm_2.In)(meetings.map((meeting) => meeting.id)) },
            order: { createdAt: 'ASC' },
        });
        const actionItemsByMeeting = new Map();
        for (const item of actionItems) {
            const list = actionItemsByMeeting.get(item.meetingId) ?? [];
            list.push(item);
            actionItemsByMeeting.set(item.meetingId, list);
        }
        return meetings.map((meeting) => ({ ...meeting, actionItems: actionItemsByMeeting.get(meeting.id) ?? [] }));
    }
    async getOne(id, req) {
        const clientId = req.user.role === user_role_enum_1.UserRole.CLIENT ? req.user.clientId : undefined;
        if (req.user.role === user_role_enum_1.UserRole.CLIENT && !clientId)
            throw new common_1.ForbiddenException('Client account is not associated');
        const meeting = await this.repo.findOne({ where: { id, organizationId: req.organizationId, ...(clientId ? { clientId } : {}) } });
        if (!meeting)
            throw new common_1.NotFoundException('Meeting not found');
        await this.assertClientAccess(req, meeting.clientId);
        const actionItems = await this.actionItemRepo.find({ where: { meetingId: id }, order: { createdAt: 'ASC' } });
        return { ...meeting, actionItems };
    }
    async update(id, dto, req) {
        const meeting = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!meeting)
            throw new common_1.NotFoundException('Meeting not found');
        await this.assertClientAccess(req, meeting.clientId);
        await this.assertClientAccess(req, dto.clientId);
        if (dto.clientId !== undefined)
            meeting.clientId = dto.clientId;
        if (dto.title !== undefined)
            meeting.title = dto.title.trim();
        if (dto.type !== undefined)
            meeting.type = dto.type;
        const previousStatus = meeting.status;
        if (dto.status !== undefined)
            meeting.status = dto.status;
        if (dto.scheduledAt !== undefined)
            meeting.scheduledAt = new Date(dto.scheduledAt);
        if (dto.durationMinutes !== undefined)
            meeting.durationMinutes = dto.durationMinutes;
        if (dto.location !== undefined)
            meeting.location = dto.location.trim() || undefined;
        if (dto.meetingLink !== undefined)
            meeting.meetingLink = dto.meetingLink;
        if (dto.minutes !== undefined || dto.notes !== undefined) {
            meeting.minutes = dto.minutes?.trim() || dto.notes?.trim() || undefined;
        }
        const saved = await this.repo.save(meeting);
        if (meeting.clientId && previousStatus !== meeting.status && [previousStatus, meeting.status].includes('completed')) {
            const period = new Date(meeting.scheduledAt);
            if (meeting.type === meeting_type_enum_1.MeetingType.STRATEGIC) {
                await this.repo.manager.query('UPDATE account_cycles SET strategy_meeting_status = ? WHERE organization_id = ? AND client_id = ? AND year = ? AND month = ?', [meeting.status === 'completed' ? 'completed' : 'pending', req.organizationId, meeting.clientId, period.getFullYear(), period.getMonth() + 1]);
            }
            else {
                await this.repo.manager.query('UPDATE account_cycles SET weekly_meetings_completed = GREATEST(0, weekly_meetings_completed + ?) WHERE organization_id = ? AND client_id = ? AND year = ? AND month = ?', [meeting.status === 'completed' ? 1 : -1, req.organizationId, meeting.clientId, period.getFullYear(), period.getMonth() + 1]);
            }
        }
        return saved;
    }
    async remove(id, req) {
        const meeting = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!meeting)
            throw new common_1.NotFoundException('Meeting not found');
        await this.assertClientAccess(req, meeting.clientId);
        return this.repo.remove(meeting);
    }
    async publishCalendar(id, req) {
        const meeting = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!meeting)
            throw new common_1.NotFoundException('Meeting not found');
        await this.assertClientAccess(req, meeting.clientId);
        const event = await this.calendar.createEvent(req.organizationId, { summary: meeting.title, description: meeting.minutes, start: new Date(meeting.scheduledAt), durationMinutes: meeting.durationMinutes });
        meeting.location = event.calendarUrl ?? meeting.location;
        meeting.meetingLink = event.meetingLink ?? meeting.meetingLink;
        await this.repo.save(meeting);
        return { ...event, meeting };
    }
    async createActionItem(id, dto, req) {
        const meeting = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!meeting)
            throw new common_1.NotFoundException('Meeting not found');
        await this.assertClientAccess(req, meeting.clientId);
        await this.assertAssignee(req.organizationId, dto.assignedTo);
        return this.actionItemRepo.save(this.actionItemRepo.create({
            meetingId: id,
            description: dto.description.trim(),
            assignedTo: dto.assignedTo,
            dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
            status: action_item_status_enum_1.ActionItemStatus.PENDING,
        }));
    }
    async updateActionItem(actionItemId, dto, req) {
        const actionItem = await this.actionItemRepo.findOne({
            where: { id: actionItemId },
            relations: ['meeting'],
        });
        if (!actionItem || actionItem.meeting.organizationId !== req.organizationId)
            throw new common_1.NotFoundException('Action item not found');
        await this.assertClientAccess(req, actionItem.meeting.clientId);
        if (req.user.role === user_role_enum_1.UserRole.CLIENT && (dto.description !== undefined || dto.assignedTo !== undefined || dto.dueAt !== undefined)) {
            throw new common_1.ForbiddenException('El cliente solo puede actualizar el estado del compromiso');
        }
        await this.assertAssignee(req.organizationId, dto.assignedTo);
        if (dto.description != null)
            actionItem.description = dto.description.trim();
        if (dto.assignedTo !== undefined)
            actionItem.assignedTo = dto.assignedTo;
        if (dto.dueAt !== undefined)
            actionItem.dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
        if (dto.status) {
            actionItem.status = dto.status;
            actionItem.completedAt = dto.status === action_item_status_enum_1.ActionItemStatus.COMPLETED ? new Date() : undefined;
        }
        return this.actionItemRepo.save(actionItem);
    }
    async assertClientAccess(req, clientId) {
        if (!clientId) {
            if ([user_role_enum_1.UserRole.CLIENT, user_role_enum_1.UserRole.COMMUNITY_MANAGER].includes(req.user.role)) {
                throw new common_1.NotFoundException('Meeting not found');
            }
            return;
        }
        const client = await this.clientRepo.findOne({ where: { id: clientId, organizationId: req.organizationId } });
        if (!client)
            throw new common_1.NotFoundException('Client not found');
        if (req.user.role === user_role_enum_1.UserRole.CLIENT && req.user.clientId !== client.id)
            throw new common_1.NotFoundException('Client not found');
        if (req.user.role === user_role_enum_1.UserRole.COMMUNITY_MANAGER && client.communityManagerId !== req.user.id) {
            throw new common_1.NotFoundException('Client not found');
        }
    }
    async assertAssignee(organizationId, userId) {
        if (!userId)
            return;
        const user = await this.userRepo.findOne({ where: { id: userId, organizationId, isActive: true } });
        if (!user)
            throw new common_1.BadRequestException('El responsable no pertenece a esta organizacion');
    }
};
exports.MeetingsController = MeetingsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Crear una nueva reunion' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_meeting_dto_1.CreateMeetingDto, Object]),
    __metadata("design:returntype", Promise)
], MeetingsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Listar reuniones' }),
    __param(0, (0, common_1.Query)('type')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MeetingsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener una reunion' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MeetingsController.prototype, "getOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar una reunion' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_meeting_dto_1.UpdateMeetingDto, Object]),
    __metadata("design:returntype", Promise)
], MeetingsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Eliminar una reunion' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MeetingsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/google-calendar'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Publicar reunion en Google Calendar' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MeetingsController.prototype, "publishCalendar", null);
__decorate([
    (0, common_1.Post)(':id/action-items'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Crear compromiso de reunion' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_action_item_dto_1.CreateActionItemDto, Object]),
    __metadata("design:returntype", Promise)
], MeetingsController.prototype, "createActionItem", null);
__decorate([
    (0, common_1.Put)('action-items/:actionItemId'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar compromiso de reunion' }),
    __param(0, (0, common_1.Param)('actionItemId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_action_item_dto_1.UpdateActionItemDto, Object]),
    __metadata("design:returntype", Promise)
], MeetingsController.prototype, "updateActionItem", null);
exports.MeetingsController = MeetingsController = __decorate([
    (0, swagger_1.ApiTags)('Reuniones'),
    (0, common_1.Controller)('meetings'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('meetings'),
    __param(0, (0, typeorm_1.InjectRepository)(meeting_entity_1.Meeting)),
    __param(1, (0, typeorm_1.InjectRepository)(action_item_entity_1.ActionItem)),
    __param(2, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        create_meeting_use_case_1.CreateMeetingUseCase,
        list_meetings_use_case_1.ListMeetingsUseCase,
        google_calendar_service_1.GoogleCalendarService])
], MeetingsController);
