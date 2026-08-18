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
exports.UpdateApprovalStatusUseCase = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const approval_request_entity_1 = require("./approval-request.entity");
const approval_request_status_enum_1 = require("./approval-request-status.enum");
const piece_entity_1 = require("../production/piece.entity");
const piece_status_enum_1 = require("../production/piece-status.enum");
const user_role_enum_1 = require("../organizations/user-role.enum");
const correction_entity_1 = require("../production/correction.entity");
const correction_origin_enum_1 = require("../production/correction-origin.enum");
const piece_version_entity_1 = require("../production/piece-version.entity");
const piece_rules_service_1 = require("../production/piece-rules.service");
const production_workflow_service_1 = require("../production/production-workflow.service");
let UpdateApprovalStatusUseCase = class UpdateApprovalStatusUseCase {
    constructor(repo, pieceRules, workflow, events) {
        this.repo = repo;
        this.pieceRules = pieceRules;
        this.workflow = workflow;
        this.events = events;
    }
    async execute(id, organizationId, actor, status, decisionNotes) {
        if (![approval_request_status_enum_1.ApprovalRequestStatus.APPROVED, approval_request_status_enum_1.ApprovalRequestStatus.REJECTED].includes(status)) {
            throw new common_1.BadRequestException('La decisión debe ser approved o rejected');
        }
        const notes = decisionNotes?.trim();
        if (status === approval_request_status_enum_1.ApprovalRequestStatus.REJECTED && !notes) {
            throw new common_1.BadRequestException('Debes indicar el motivo de la corrección');
        }
        const result = await this.repo.manager.transaction(async (manager) => {
            const approval = await manager.findOne(approval_request_entity_1.ApprovalRequest, { where: { id, organizationId } });
            if (!approval)
                throw new common_1.NotFoundException('Approval request not found');
            if (actor.role === user_role_enum_1.UserRole.CLIENT && approval.clientId !== actor.clientId) {
                throw new common_1.NotFoundException('Approval request not found');
            }
            if (![approval_request_status_enum_1.ApprovalRequestStatus.PENDING, approval_request_status_enum_1.ApprovalRequestStatus.VIEWED].includes(approval.status)) {
                throw new common_1.BadRequestException('Esta solicitud ya fue resuelta');
            }
            approval.status = status;
            approval.decisionAt = new Date();
            approval.decisionNotes = notes || undefined;
            if (actor.userId)
                approval.assignedTo = actor.userId;
            let correctionEvent;
            if (approval.entityType === 'piece') {
                const piece = await manager.findOne(piece_entity_1.Piece, { where: { id: approval.entityId, organizationId } });
                if (!piece)
                    throw new common_1.NotFoundException('Piece not found');
                if (piece.status !== piece_status_enum_1.PieceStatus.CLIENT_VALIDATION) {
                    throw new common_1.BadRequestException('La pieza ya no está pendiente de validación');
                }
                if (status === approval_request_status_enum_1.ApprovalRequestStatus.APPROVED) {
                    piece.status = piece_status_enum_1.PieceStatus.APPROVED;
                    await this.workflow.settleBillableCorrections(piece, actor.userId, manager);
                }
                else {
                    const origin = actor.role === user_role_enum_1.UserRole.CLIENT
                        ? correction_origin_enum_1.CorrectionOrigin.CLIENT_REQUEST
                        : correction_origin_enum_1.CorrectionOrigin.INTERNAL_FEEDBACK;
                    const currentCount = origin === correction_origin_enum_1.CorrectionOrigin.CLIENT_REQUEST
                        ? piece.clientCorrectionCount
                        : piece.correctionCount;
                    const rule = await this.pieceRules.canRequestCorrection(currentCount, false, organizationId);
                    if (!rule.allowed)
                        throw new common_1.BadRequestException(rule.reason);
                    piece.correctionCount += 1;
                    if (origin === correction_origin_enum_1.CorrectionOrigin.CLIENT_REQUEST)
                        piece.clientCorrectionCount += 1;
                    piece.status = piece_status_enum_1.PieceStatus.CORRECTION;
                    const latestVersion = await manager.findOne(piece_version_entity_1.PieceVersion, {
                        where: { pieceId: piece.id },
                        order: { versionNumber: 'DESC' },
                    });
                    const billable = origin === correction_origin_enum_1.CorrectionOrigin.CLIENT_REQUEST
                        && await this.pieceRules.shouldGenerateInvoice(piece.clientCorrectionCount, organizationId);
                    const correction = await manager.save(correction_entity_1.Correction, manager.create(correction_entity_1.Correction, {
                        pieceId: piece.id,
                        pieceVersionId: latestVersion?.id,
                        origin,
                        description: notes,
                        requestedBy: actor.userId,
                        billableExtra: billable,
                        chargeNoteRequired: billable,
                    }));
                    correctionEvent = { pieceId: piece.id, correctionId: correction.id, origin };
                }
                await manager.save(piece_entity_1.Piece, piece);
            }
            return { approval: await manager.save(approval_request_entity_1.ApprovalRequest, approval), correctionEvent };
        });
        if (result.correctionEvent)
            this.events.emit('piece.rejected', result.correctionEvent);
        return result.approval;
    }
};
exports.UpdateApprovalStatusUseCase = UpdateApprovalStatusUseCase;
exports.UpdateApprovalStatusUseCase = UpdateApprovalStatusUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(approval_request_entity_1.ApprovalRequest)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        piece_rules_service_1.PieceRulesService,
        production_workflow_service_1.ProductionWorkflowService,
        event_emitter_1.EventEmitter2])
], UpdateApprovalStatusUseCase);
