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
exports.ProductionController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const assign_piece_use_case_1 = require("./assign-piece.use-case");
const submit_version_use_case_1 = require("./submit-version.use-case");
const reject_piece_use_case_1 = require("./reject-piece.use-case");
const deliver_piece_use_case_1 = require("./deliver-piece.use-case");
const list_pieces_use_case_1 = require("./list-pieces.use-case");
const piece_entity_1 = require("./piece.entity");
const piece_status_enum_1 = require("./piece-status.enum");
const assign_piece_dto_1 = require("./dto/assign-piece.dto");
const submit_version_dto_1 = require("./dto/submit-version.dto");
const reject_piece_dto_1 = require("./dto/reject-piece.dto");
const create_piece_dto_1 = require("./dto/create-piece.dto");
const cancel_piece_dto_1 = require("./dto/cancel-piece.dto");
const cancel_piece_use_case_1 = require("./cancel-piece.use-case");
const piece_types_service_1 = require("./piece-types.service");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const requires_permission_decorator_1 = require("../../core/authorization/requires-permission.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const approval_request_entity_1 = require("../approvals/approval-request.entity");
const approval_request_status_enum_1 = require("../approvals/approval-request-status.enum");
const piece_version_entity_1 = require("./piece-version.entity");
const ud_values_service_1 = require("../design-budget/ud-values.service");
const client_entity_1 = require("../clients/client.entity");
const user_entity_1 = require("../users/user.entity");
const account_access_service_1 = require("../../core/client-scope/account-access.service");
const parameter_resolver_service_1 = require("../../core/parameters/parameter-resolver.service");
const requires_feature_decorator_1 = require("../../core/authorization/requires-feature.decorator");
let ProductionController = class ProductionController {
    constructor(pieceRepo, approvalRepo, versionRepo, clientRepo, userRepo, accountAccess, parameters, udValues, pieceTypes, assignPiece, cancelPiece, submitVer, rejectPiece, deliverPiece, listPieces) {
        this.pieceRepo = pieceRepo;
        this.approvalRepo = approvalRepo;
        this.versionRepo = versionRepo;
        this.clientRepo = clientRepo;
        this.userRepo = userRepo;
        this.accountAccess = accountAccess;
        this.parameters = parameters;
        this.udValues = udValues;
        this.pieceTypes = pieceTypes;
        this.assignPiece = assignPiece;
        this.cancelPiece = cancelPiece;
        this.submitVer = submitVer;
        this.rejectPiece = rejectPiece;
        this.deliverPiece = deliverPiece;
        this.listPieces = listPieces;
    }
    async create(dto, req) {
        const client = await this.clientRepo.findOne({ where: { id: dto.clientId, organizationId: req.organizationId } });
        if (!client)
            throw new common_1.BadRequestException('El cliente no pertenece a esta organización');
        await this.pieceTypes.assertUsable(req.organizationId, [dto.type]);
        if (dto.dependencyIds?.length) {
            const dependencyCount = await this.pieceRepo.count({ where: { id: (0, typeorm_2.In)(dto.dependencyIds), organizationId: req.organizationId } });
            if (dependencyCount !== new Set(dto.dependencyIds).size)
                throw new common_1.BadRequestException('Una o más dependencias no pertenecen a esta organización');
        }
        const { carouselSlides, deadlineAt, ...pieceData } = dto;
        const piece = this.pieceRepo.create({
            ...pieceData,
            organizationId: req.organizationId,
            status: piece_status_enum_1.PieceStatus.BACKLOG,
            title: dto.title.trim(),
            deadlineAt: deadlineAt ? new Date(deadlineAt) : undefined,
            udAmount: await this.udValues.udFor(dto.type, carouselSlides, req.organizationId),
        });
        return this.pieceRepo.save(piece);
    }
    async list(status, clientId, assignedTo, req) {
        const effectiveAssignee = [user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL].includes(req.user.role)
            ? req.user.id
            : assignedTo;
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        const clientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.listPieces.execute(req.organizationId, status, clientId, effectiveAssignee, clientIds);
    }
    assigneeOptions(req) {
        return this.userRepo.find({
            select: { id: true, name: true, role: true, weeklyCapacityUd: true },
            where: {
                organizationId: req.organizationId,
                isActive: true,
                role: (0, typeorm_2.In)([user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR]),
            },
            order: { name: 'ASC' },
        });
    }
    assign(id, dto, req) {
        return this.assignPiece.execute(id, dto.designerId, req.organizationId, req.user.id);
    }
    async versions(id, req) {
        const piece = await this.pieceRepo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!piece)
            throw new common_1.NotFoundException('Piece not found');
        await this.accountAccess.assertClient(req.organizationId, req.user, piece.clientId);
        const rows = await this.versionRepo.find({ where: { pieceId: piece.id }, order: { versionNumber: 'DESC' } });
        return rows.map((row) => ({
            id: row.id,
            versionNumber: row.versionNumber,
            fileName: row.fileName,
            driveFileId: row.driveFileId ?? undefined,
            stateLabel: row.stateLabel ?? undefined,
            isFinal: row.isFinal,
            namingValid: row.namingValid ?? undefined,
            createdAt: row.createdAt.toISOString(),
        }));
    }
    submitVersion(id, dto, req) {
        return this.submitVer.execute(id, req.organizationId, { ...dto, userId: req.user.id, role: req.user.role });
    }
    async reject(id, dto, req) {
        const piece = await this.pieceRepo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!piece)
            throw new common_1.NotFoundException('Piece not found');
        await this.accountAccess.assertClient(req.organizationId, req.user, piece.clientId);
        return this.rejectPiece.execute(id, req.organizationId, {
            ...dto,
            userId: req.user.id,
            role: req.user.role,
            clientId: req.user.clientId,
        });
    }
    cancel(id, dto, req) {
        return this.cancelPiece.execute(id, req.organizationId, dto.reason, dto.origin, req.user.id);
    }
    deliver(id, req) {
        return this.deliverPiece.execute(id, req.organizationId, req.user.id);
    }
    async approve(id, req) {
        const piece = await this.pieceRepo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!piece)
            throw new common_1.NotFoundException('Piece not found');
        await this.accountAccess.assertClient(req.organizationId, req.user, piece.clientId);
        if (piece.status !== piece_status_enum_1.PieceStatus.CLIENT_VALIDATION)
            throw new common_1.BadRequestException('La pieza no está pendiente de aprobación');
        piece.status = piece_status_enum_1.PieceStatus.APPROVED;
        return this.pieceRepo.save(piece);
    }
    async startProgress(id, req) {
        const piece = await this.pieceRepo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!piece)
            throw new common_1.NotFoundException('Piece not found');
        if ([user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL].includes(req.user.role) && piece.assignedTo !== req.user.id) {
            throw new common_1.ForbiddenException('Solo el responsable asignado puede iniciar esta pieza');
        }
        if (![piece_status_enum_1.PieceStatus.ASSIGNED, piece_status_enum_1.PieceStatus.CORRECTION].includes(piece.status)) {
            throw new common_1.BadRequestException('La pieza debe estar asignada o en corrección para iniciar el trabajo');
        }
        piece.status = piece_status_enum_1.PieceStatus.IN_PROGRESS;
        piece.startedAt = piece.startedAt ?? new Date();
        return this.pieceRepo.save(piece);
    }
    async sendToClient(id, req) {
        const piece = await this.pieceRepo.findOne({ where: { id, organizationId: req.organizationId }, relations: ['client'] });
        if (!piece)
            throw new common_1.NotFoundException('Piece not found');
        if (piece.status !== piece_status_enum_1.PieceStatus.INTERNAL_REVIEW)
            throw new common_1.BadRequestException('La pieza debe estar en revisión interna');
        const latestVersion = await this.versionRepo.findOne({
            where: { pieceId: piece.id },
            order: { versionNumber: 'DESC' },
        });
        if (!latestVersion)
            throw new common_1.BadRequestException('Debes cargar una versión antes de enviarla al cliente');
        const validationMonths = Number(await this.parameters.get('production.client_validation_months', piece.clientId, null, req.organizationId) ?? 3);
        const clientStartedAt = piece.client?.createdAt ? new Date(piece.client.createdAt) : new Date();
        const automaticApprovalAt = new Date(clientStartedAt);
        automaticApprovalAt.setMonth(automaticApprovalAt.getMonth() + validationMonths);
        if (validationMonths === 0 || automaticApprovalAt <= new Date()) {
            piece.status = piece_status_enum_1.PieceStatus.APPROVED;
            return this.pieceRepo.save(piece);
        }
        piece.status = piece_status_enum_1.PieceStatus.CLIENT_VALIDATION;
        await this.pieceRepo.save(piece);
        const existingPending = await this.approvalRepo.findOne({
            where: {
                organizationId: req.organizationId,
                entityType: 'piece',
                entityId: piece.id,
                status: approval_request_status_enum_1.ApprovalRequestStatus.PENDING,
            },
        });
        if (!existingPending) {
            await this.approvalRepo.save(this.approvalRepo.create({
                organizationId: req.organizationId,
                clientId: piece.clientId,
                title: piece.title,
                description: piece.client?.name,
                entityType: 'piece',
                entityId: piece.id,
                requestedBy: req.user.id,
                dueAt: piece.deadlineAt,
            }));
        }
        return piece;
    }
};
exports.ProductionController = ProductionController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Crear una nueva pieza' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_piece_dto_1.CreatePieceDto, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar piezas de produccion' }),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('clientId')),
    __param(2, (0, common_1.Query)('assignedTo')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('options/assignees'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Listar responsables creativos activos' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "assigneeOptions", null);
__decorate([
    (0, common_1.Post)(':id/assign'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Asignar responsable a una pieza' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, assign_piece_dto_1.AssignPieceDto, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "assign", null);
__decorate([
    (0, common_1.Get)(':id/versions'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar versiones de una pieza' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "versions", null);
__decorate([
    (0, common_1.Post)(':id/versions'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Subir nueva version de una pieza' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submit_version_dto_1.SubmitVersionDto, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "submitVersion", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, requires_permission_decorator_1.RequiresPermission)('approvals', 'edit'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Rechazar pieza y solicitar correccion' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, reject_piece_dto_1.RejectPieceDto, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Cancelar pieza y devolver sus unidades segun la regla configurada' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cancel_piece_dto_1.CancelPieceDto, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)(':id/deliver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Entregar pieza al cliente' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "deliver", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, requires_permission_decorator_1.RequiresPermission)('approvals', 'edit'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Aprobar pieza internamente' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/start'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Iniciar progreso de una pieza' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "startProgress", null);
__decorate([
    (0, common_1.Post)(':id/send-to-client'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Enviar pieza a validacion del cliente' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "sendToClient", null);
exports.ProductionController = ProductionController = __decorate([
    (0, swagger_1.ApiTags)('Produccion'),
    (0, common_1.Controller)('production/pieces'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL),
    (0, requires_feature_decorator_1.RequiresFeature)('production'),
    __param(0, (0, typeorm_1.InjectRepository)(piece_entity_1.Piece)),
    __param(1, (0, typeorm_1.InjectRepository)(approval_request_entity_1.ApprovalRequest)),
    __param(2, (0, typeorm_1.InjectRepository)(piece_version_entity_1.PieceVersion)),
    __param(3, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(4, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        account_access_service_1.AccountAccessService,
        parameter_resolver_service_1.ParameterResolver,
        ud_values_service_1.UdValuesService,
        piece_types_service_1.PieceTypesService,
        assign_piece_use_case_1.AssignPieceUseCase,
        cancel_piece_use_case_1.CancelPieceUseCase,
        submit_version_use_case_1.SubmitVersionUseCase,
        reject_piece_use_case_1.RejectPieceUseCase,
        deliver_piece_use_case_1.DeliverPieceUseCase,
        list_pieces_use_case_1.ListPiecesUseCase])
], ProductionController);
