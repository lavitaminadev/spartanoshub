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
exports.OpportunityCommentsController = exports.LeadCommentsController = exports.WorkRequestCommentsController = exports.SessionCommentsController = exports.PieceCommentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const process_comments_service_1 = require("./process-comments.service");
const process_comment_entity_1 = require("./process-comment.entity");
const process_comment_dto_1 = require("./dto/process-comment.dto");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
class BaseCommentsController {
    constructor(service) {
        this.service = service;
    }
    thread(subjectId, req) {
        return this.service.thread(req.organizationId, this.subject, subjectId, { role: req.user.role });
    }
    add(subjectId, dto, req) {
        return this.service.add(req.organizationId, this.subject, subjectId, dto.body, dto.visibility ?? process_comment_entity_1.CommentVisibility.INTERNAL, { id: req.user.id, role: req.user.role, name: req.user.name });
    }
    edit(commentId, dto, req) {
        return this.service.edit(req.organizationId, commentId, dto.body, {
            id: req.user.id, role: req.user.role, name: req.user.name,
        });
    }
}
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Hilo del trabajo, con proceso y revision en secciones separadas' }),
    __param(0, (0, common_1.Param)('subjectId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BaseCommentsController.prototype, "thread", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Agregar un comentario al hilo del trabajo' }),
    __param(0, (0, common_1.Param)('subjectId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, process_comment_dto_1.AddCommentDto, Object]),
    __metadata("design:returntype", void 0)
], BaseCommentsController.prototype, "add", null);
__decorate([
    (0, common_1.Patch)(':commentId'),
    (0, swagger_1.ApiOperation)({ summary: 'Corregir un comentario propio' }),
    __param(0, (0, common_1.Param)('commentId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, process_comment_dto_1.EditCommentDto, Object]),
    __metadata("design:returntype", void 0)
], BaseCommentsController.prototype, "edit", null);
let PieceCommentsController = class PieceCommentsController extends BaseCommentsController {
    constructor(service) {
        super(service);
        this.subject = process_comment_entity_1.CommentSubject.PIECE;
    }
};
exports.PieceCommentsController = PieceCommentsController;
exports.PieceCommentsController = PieceCommentsController = __decorate([
    (0, swagger_1.ApiTags)('Produccion'),
    (0, common_1.Controller)('production/pieces/:subjectId/comments'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('production'),
    __metadata("design:paramtypes", [process_comments_service_1.ProcessCommentsService])
], PieceCommentsController);
let SessionCommentsController = class SessionCommentsController extends BaseCommentsController {
    constructor(service) {
        super(service);
        this.subject = process_comment_entity_1.CommentSubject.SESSION;
    }
};
exports.SessionCommentsController = SessionCommentsController;
exports.SessionCommentsController = SessionCommentsController = __decorate([
    (0, swagger_1.ApiTags)('Audiovisual'),
    (0, common_1.Controller)('audiovisual/sessions/:subjectId/comments'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('audiovisual'),
    __metadata("design:paramtypes", [process_comments_service_1.ProcessCommentsService])
], SessionCommentsController);
let WorkRequestCommentsController = class WorkRequestCommentsController extends BaseCommentsController {
    constructor(service) {
        super(service);
        this.subject = process_comment_entity_1.CommentSubject.WORK_REQUEST;
    }
};
exports.WorkRequestCommentsController = WorkRequestCommentsController;
exports.WorkRequestCommentsController = WorkRequestCommentsController = __decorate([
    (0, swagger_1.ApiTags)('Intake'),
    (0, common_1.Controller)('intake/requests/:subjectId/comments'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('operations'),
    __metadata("design:paramtypes", [process_comments_service_1.ProcessCommentsService])
], WorkRequestCommentsController);
let LeadCommentsController = class LeadCommentsController extends BaseCommentsController {
    constructor(service) {
        super(service);
        this.subject = process_comment_entity_1.CommentSubject.LEAD;
    }
};
exports.LeadCommentsController = LeadCommentsController;
exports.LeadCommentsController = LeadCommentsController = __decorate([
    (0, swagger_1.ApiTags)('CRM'),
    (0, common_1.Controller)('crm/leads/:subjectId/comments'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('crm'),
    __metadata("design:paramtypes", [process_comments_service_1.ProcessCommentsService])
], LeadCommentsController);
let OpportunityCommentsController = class OpportunityCommentsController extends BaseCommentsController {
    constructor(service) {
        super(service);
        this.subject = process_comment_entity_1.CommentSubject.OPPORTUNITY;
    }
};
exports.OpportunityCommentsController = OpportunityCommentsController;
exports.OpportunityCommentsController = OpportunityCommentsController = __decorate([
    (0, swagger_1.ApiTags)('CRM'),
    (0, common_1.Controller)('crm/opportunities/:subjectId/comments'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('crm'),
    __metadata("design:paramtypes", [process_comments_service_1.ProcessCommentsService])
], OpportunityCommentsController);
