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
exports.ProductionWorkflowService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const piece_entity_1 = require("./piece.entity");
const piece_version_entity_1 = require("./piece-version.entity");
const correction_entity_1 = require("./correction.entity");
const piece_status_enum_1 = require("./piece-status.enum");
const correction_origin_enum_1 = require("./correction-origin.enum");
const design_budget_service_1 = require("../design-budget/design-budget.service");
const xp_service_1 = require("../gamification/xp.service");
const billing_service_1 = require("../billing/billing.service");
let ProductionWorkflowService = class ProductionWorkflowService {
    constructor(pieceRepo, versionRepo, correctionRepo, designBudget, xp, billing) {
        this.pieceRepo = pieceRepo;
        this.versionRepo = versionRepo;
        this.correctionRepo = correctionRepo;
        this.designBudget = designBudget;
        this.xp = xp;
        this.billing = billing;
    }
    async assign(piece, designerId, pieceType, difficultyLevel, carouselSlides = 0, actorId) {
        await this.pieceRepo.manager.transaction(async (manager) => {
            const udAmount = this.designBudget.calculateForPiece(pieceType, carouselSlides);
            piece.assignedTo = designerId;
            piece.type = pieceType;
            piece.difficultyLevel = difficultyLevel;
            piece.udAmount = udAmount;
            piece.status = piece_status_enum_1.PieceStatus.ASSIGNED;
            await manager.save(piece_entity_1.Piece, piece);
            await this.designBudget.reserveForPiece(piece, actorId, manager);
        });
    }
    async submitVersion(piece, fileName, driveFileId, userId) {
        const maxResult = await this.versionRepo.findOne({
            where: { pieceId: piece.id },
            order: { versionNumber: 'DESC' },
        });
        const nextVersion = (maxResult?.versionNumber ?? 0) + 1;
        const version = this.versionRepo.create({
            pieceId: piece.id,
            versionNumber: nextVersion,
            fileName,
            driveFileId,
            createdBy: userId,
        });
        const saved = await this.versionRepo.save(version);
        piece.status = piece_status_enum_1.PieceStatus.INTERNAL_REVIEW;
        await this.pieceRepo.save(piece);
        return saved;
    }
    async rejectByClient(piece, version, comment, clientUserId) {
        await this.pieceRepo.manager.transaction(async (manager) => {
            piece.clientCorrectionCount = (piece.clientCorrectionCount ?? 0) + 1;
            piece.correctionCount = (piece.correctionCount ?? 0) + 1;
            const shouldGenerateChargeNote = piece.clientCorrectionCount > 3;
            const correction = manager.create(correction_entity_1.Correction, {
                pieceId: piece.id,
                pieceVersionId: version.id,
                origin: correction_origin_enum_1.CorrectionOrigin.CLIENT_REQUEST,
                description: comment,
                requestedBy: clientUserId,
                billableExtra: shouldGenerateChargeNote,
                chargeNoteRequired: shouldGenerateChargeNote,
            });
            const savedCorrection = await manager.save(correction_entity_1.Correction, correction);
            if (shouldGenerateChargeNote) {
                await this.billing.createCorrectionCharge({
                    organizationId: piece.organizationId,
                    clientId: piece.clientId,
                    pieceId: piece.id,
                    correctionId: savedCorrection.id,
                    correctionNumber: piece.clientCorrectionCount,
                    createdBy: clientUserId,
                }, manager);
            }
            piece.status = piece_status_enum_1.PieceStatus.CORRECTION;
            await manager.save(piece_entity_1.Piece, piece);
        });
    }
    async deliver(piece, actorId) {
        await this.pieceRepo.manager.transaction(async (manager) => {
            piece.status = piece_status_enum_1.PieceStatus.DELIVERED;
            piece.deliveredAt = new Date();
            await manager.save(piece_entity_1.Piece, piece);
            const freshPiece = await manager.findOne(piece_entity_1.Piece, { where: { id: piece.id } });
            await this.designBudget.confirmConsumption(piece, actorId, manager);
            if (freshPiece?.assignedTo) {
                await this.xp.registerDelivery(freshPiece, freshPiece.assignedTo, new Date(), manager);
            }
        });
    }
    async flagDesignerError(piece, version, description, artDirectorId) {
        await this.pieceRepo.manager.transaction(async (manager) => {
            piece.correctionCount = (piece.correctionCount ?? 0) + 1;
            const correction = manager.create(correction_entity_1.Correction, {
                pieceId: piece.id,
                pieceVersionId: version.id,
                origin: correction_origin_enum_1.CorrectionOrigin.DESIGNER_ERROR,
                description,
                requestedBy: artDirectorId,
                billableExtra: false,
                chargeNoteRequired: false,
            });
            await manager.save(correction_entity_1.Correction, correction);
            if (piece.assignedTo) {
                await this.xp.registerDesignerErrorPenalty(piece, piece.assignedTo, manager);
            }
        });
    }
};
exports.ProductionWorkflowService = ProductionWorkflowService;
exports.ProductionWorkflowService = ProductionWorkflowService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(piece_entity_1.Piece)),
    __param(1, (0, typeorm_1.InjectRepository)(piece_version_entity_1.PieceVersion)),
    __param(2, (0, typeorm_1.InjectRepository)(correction_entity_1.Correction)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        design_budget_service_1.DesignBudgetService,
        xp_service_1.XPService,
        billing_service_1.BillingService])
], ProductionWorkflowService);
//# sourceMappingURL=production-workflow.service.js.map