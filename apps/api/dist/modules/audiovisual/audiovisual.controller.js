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
exports.AudiovisualController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const audiovisual_service_1 = require("./audiovisual.service");
const create_moodboard_dto_1 = require("./dto/create-moodboard.dto");
const update_moodboard_dto_1 = require("./dto/update-moodboard.dto");
const create_session_dto_1 = require("./dto/create-session.dto");
const update_session_dto_1 = require("./dto/update-session.dto");
const pagination_dto_1 = require("../../shared/dto/pagination.dto");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const requires_feature_decorator_1 = require("../../core/authorization/requires-feature.decorator");
let AudiovisualController = class AudiovisualController {
    constructor(service) {
        this.service = service;
    }
    createMoodboard(dto, req) {
        return this.service.createMoodboard(dto, req.organizationId, req.user.id);
    }
    findAllMoodboards(query, req) {
        return this.service.findAllMoodboards(req.organizationId, query.limit, query.offset);
    }
    findOneMoodboard(id, req) {
        return this.service.findOneMoodboard(id, req.organizationId);
    }
    updateMoodboard(id, dto, req) {
        return this.service.updateMoodboard(id, dto, req.organizationId);
    }
    removeMoodboard(id, req) {
        return this.service.removeMoodboard(id, req.organizationId);
    }
    createSession(dto, req) {
        return this.service.createSession(dto, req.organizationId);
    }
    findAllSessions(query, req) {
        const assignedTo = req.user.role === user_role_enum_1.UserRole.AUDIOVISUAL ? req.user.id : undefined;
        return this.service.findAllSessions(req.organizationId, query.limit, query.offset, assignedTo);
    }
    async findOneSession(id, req) {
        const session = await this.service.findOneSession(id, req.organizationId);
        if (req.user.role === user_role_enum_1.UserRole.AUDIOVISUAL && !session.assignedTeam?.includes(req.user.id)) {
            throw new common_1.NotFoundException('Session not found');
        }
        return session;
    }
    updateSession(id, dto, req) {
        return this.service.updateSession(id, dto, req.organizationId);
    }
    removeSession(id, req) {
        return this.service.removeSession(id, req.organizationId);
    }
};
exports.AudiovisualController = AudiovisualController;
__decorate([
    (0, common_1.Post)('moodboards'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_moodboard_dto_1.CreateMoodboardDto, Object]),
    __metadata("design:returntype", void 0)
], AudiovisualController.prototype, "createMoodboard", null);
__decorate([
    (0, common_1.Get)('moodboards'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationDto, Object]),
    __metadata("design:returntype", void 0)
], AudiovisualController.prototype, "findAllMoodboards", null);
__decorate([
    (0, common_1.Get)('moodboards/:id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AudiovisualController.prototype, "findOneMoodboard", null);
__decorate([
    (0, common_1.Put)('moodboards/:id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_moodboard_dto_1.UpdateMoodboardDto, Object]),
    __metadata("design:returntype", void 0)
], AudiovisualController.prototype, "updateMoodboard", null);
__decorate([
    (0, common_1.Delete)('moodboards/:id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AudiovisualController.prototype, "removeMoodboard", null);
__decorate([
    (0, common_1.Post)('sessions'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_session_dto_1.CreateSessionDto, Object]),
    __metadata("design:returntype", void 0)
], AudiovisualController.prototype, "createSession", null);
__decorate([
    (0, common_1.Get)('sessions'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationDto, Object]),
    __metadata("design:returntype", void 0)
], AudiovisualController.prototype, "findAllSessions", null);
__decorate([
    (0, common_1.Get)('sessions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AudiovisualController.prototype, "findOneSession", null);
__decorate([
    (0, common_1.Put)('sessions/:id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_session_dto_1.UpdateSessionDto, Object]),
    __metadata("design:returntype", void 0)
], AudiovisualController.prototype, "updateSession", null);
__decorate([
    (0, common_1.Delete)('sessions/:id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AudiovisualController.prototype, "removeSession", null);
exports.AudiovisualController = AudiovisualController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.AUDIOVISUAL),
    (0, requires_feature_decorator_1.RequiresFeature)('audiovisual'),
    __metadata("design:paramtypes", [audiovisual_service_1.AudiovisualService])
], AudiovisualController);
//# sourceMappingURL=audiovisual.controller.js.map