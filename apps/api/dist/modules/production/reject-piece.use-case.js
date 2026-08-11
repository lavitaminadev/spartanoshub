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
exports.RejectPieceUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const piece_entity_1 = require("./piece.entity");
const piece_version_entity_1 = require("./piece-version.entity");
const correction_entity_1 = require("./correction.entity");
const piece_status_enum_1 = require("./piece-status.enum");
const correction_origin_enum_1 = require("./correction-origin.enum");
const piece_rules_service_1 = require("./piece-rules.service");
const event_emitter_1 = require("@nestjs/event-emitter");
const user_role_enum_1 = require("../organizations/user-role.enum");
let RejectPieceUseCase = class RejectPieceUseCase {
    constructor(pieceRepo, pieceRules, eventEmitter) {
        this.pieceRepo = pieceRepo;
        this.pieceRules = pieceRules;
        this.eventEmitter = eventEmitter;
    }
    async execute(pieceId, organizationId, data) {
        const saved = await this.pieceRepo.manager.transaction(async (manager) => {
            const piece = await manager.findOne(piece_entity_1.Piece, { where: { id: pieceId, organizationId } });
            if (!piece)
                throw new common_1.NotFoundException('Pieza no encontrada');
            if (data.role === user_role_enum_1.UserRole.CLIENT) {
                if (!data.clientId || piece.clientId !== data.clientId)
                    throw new common_1.NotFoundException('Pieza no encontrada');
                if (piece.status !== piece_status_enum_1.PieceStatus.CLIENT_VALIDATION)
                    throw new common_1.BadRequestException('La pieza no está pendiente de validación del cliente');
                data.origin = correction_origin_enum_1.CorrectionOrigin.CLIENT_REQUEST;
            }
            else if (![piece_status_enum_1.PieceStatus.INTERNAL_REVIEW, piece_status_enum_1.PieceStatus.CLIENT_VALIDATION].includes(piece.status)) {
                throw new common_1.BadRequestException('La pieza no está en una etapa de revisión');
            }
            if (data.versionId) {
                const version = await manager.findOne(piece_version_entity_1.PieceVersion, { where: { id: data.versionId, pieceId } });
                if (!version)
                    throw new common_1.ForbiddenException('La versión no pertenece a esta pieza');
            }
            const isDesignerError = data.origin === correction_origin_enum_1.CorrectionOrigin.DESIGNER_ERROR;
            const currentCount = data.origin === correction_origin_enum_1.CorrectionOrigin.CLIENT_REQUEST ? piece.clientCorrectionCount : piece.correctionCount;
            const { allowed, reason } = await this.pieceRules.canRequestCorrection(currentCount, isDesignerError, organizationId);
            if (!allowed)
                throw new common_1.BadRequestException(reason);
            piece.correctionCount += 1;
            if (data.origin === correction_origin_enum_1.CorrectionOrigin.CLIENT_REQUEST) {
                piece.clientCorrectionCount += 1;
            }
            piece.status = piece_status_enum_1.PieceStatus.CORRECTION;
            await manager.save(piece_entity_1.Piece, piece);
            const shouldGenerateChargeNote = data.origin === correction_origin_enum_1.CorrectionOrigin.CLIENT_REQUEST
                && await this.pieceRules.shouldGenerateInvoice(piece.clientCorrectionCount, organizationId);
            const correction = manager.create(correction_entity_1.Correction, {
                pieceId,
                pieceVersionId: data.versionId,
                origin: data.origin,
                description: data.comment,
                requestedBy: data.userId,
                billableExtra: shouldGenerateChargeNote,
                chargeNoteRequired: shouldGenerateChargeNote,
            });
            const saved = await manager.save(correction_entity_1.Correction, correction);
            return saved;
        });
        this.eventEmitter.emit('piece.rejected', { organizationId, pieceId, correctionId: saved.id, origin: data.origin, requestedBy: data.userId });
        return saved;
    }
};
exports.RejectPieceUseCase = RejectPieceUseCase;
exports.RejectPieceUseCase = RejectPieceUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(piece_entity_1.Piece)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        piece_rules_service_1.PieceRulesService,
        event_emitter_1.EventEmitter2])
], RejectPieceUseCase);
//# sourceMappingURL=reject-piece.use-case.js.map