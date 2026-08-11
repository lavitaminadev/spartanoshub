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
exports.ApprovalsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const list_approvals_use_case_1 = require("./list-approvals.use-case");
const update_approval_status_use_case_1 = require("./update-approval-status.use-case");
const update_approval_dto_1 = require("./dto/update-approval.dto");
const approval_request_entity_1 = require("./approval-request.entity");
const approval_request_status_enum_1 = require("./approval-request-status.enum");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const create_approval_dto_1 = require("./dto/create-approval.dto");
const client_entity_1 = require("../clients/client.entity");
const piece_entity_1 = require("../production/piece.entity");
const account_access_service_1 = require("../../core/client-scope/account-access.service");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
let ApprovalsController = class ApprovalsController {
    constructor(listApprovals, updateStatus, repo, clients, pieces, accountAccess) {
        this.listApprovals = listApprovals;
        this.updateStatus = updateStatus;
        this.repo = repo;
        this.clients = clients;
        this.pieces = pieces;
        this.accountAccess = accountAccess;
    }
    async create(dto, req) {
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
        const client = await this.clients.findOne({ where: { id: dto.clientId, organizationId: req.organizationId } });
        const piece = await this.pieces.findOne({ where: { id: dto.entityId, clientId: dto.clientId, organizationId: req.organizationId } });
        if (!client || !piece)
            throw new common_1.BadRequestException('La pieza y el cliente deben pertenecer a esta organización');
        return this.repo.save(this.repo.create({
            ...dto,
            title: dto.title.trim(),
            description: dto.description?.trim() || undefined,
            dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
            organizationId: req.organizationId,
            requestedBy: req.user.id,
            status: approval_request_status_enum_1.ApprovalRequestStatus.PENDING,
        }));
    }
    async list(req) {
        const clientId = req.user?.role === 'client' ? req.user.clientId : undefined;
        if (req.user?.role === user_role_enum_1.UserRole.CLIENT && !clientId)
            throw new common_1.ForbiddenException('Client account is not associated');
        const clientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.listApprovals.execute(req.organizationId, clientId, clientIds);
    }
    async update(id, dto, req) {
        const approval = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!approval)
            throw new common_1.BadRequestException('Approval request not found');
        await this.accountAccess.assertClient(req.organizationId, req.user, approval.clientId);
        return this.updateStatus.execute(id, req.organizationId, { userId: req.user.id, role: req.user.role, clientId: req.user.clientId }, dto.status, dto.decisionNotes);
    }
};
exports.ApprovalsController = ApprovalsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Crear solicitud de aprobación' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_approval_dto_1.CreateApprovalDto, Object]),
    __metadata("design:returntype", Promise)
], ApprovalsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Listar solicitudes de aprobación' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApprovalsController.prototype, "list", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Aprobar o rechazar solicitud' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_approval_dto_1.UpdateApprovalDto, Object]),
    __metadata("design:returntype", Promise)
], ApprovalsController.prototype, "update", null);
exports.ApprovalsController = ApprovalsController = __decorate([
    (0, swagger_1.ApiTags)('Aprobaciones'),
    (0, common_1.Controller)('approvals'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('approvals'),
    __param(2, (0, typeorm_1.InjectRepository)(approval_request_entity_1.ApprovalRequest)),
    __param(3, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(4, (0, typeorm_1.InjectRepository)(piece_entity_1.Piece)),
    __metadata("design:paramtypes", [list_approvals_use_case_1.ListApprovalsUseCase,
        update_approval_status_use_case_1.UpdateApprovalStatusUseCase,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        account_access_service_1.AccountAccessService])
], ApprovalsController);
//# sourceMappingURL=approvals.controller.js.map