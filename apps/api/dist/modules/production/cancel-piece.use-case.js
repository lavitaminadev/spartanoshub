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
exports.CancelPieceUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const piece_entity_1 = require("./piece.entity");
const piece_status_enum_1 = require("./piece-status.enum");
const design_budget_service_1 = require("../design-budget/design-budget.service");
const cancel_origin_enum_1 = require("./cancel-origin.enum");
let CancelPieceUseCase = class CancelPieceUseCase {
    constructor(pieces, designBudget) {
        this.pieces = pieces;
        this.designBudget = designBudget;
    }
    async execute(pieceId, organizationId, reason, origin, actorId) {
        const motivo = reason?.trim();
        if (!motivo)
            throw new common_1.BadRequestException('Indica por qué se cancela la pieza');
        return this.pieces.manager.transaction(async (manager) => {
            const piece = await manager.findOne(piece_entity_1.Piece, {
                where: { id: pieceId, organizationId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!piece)
                throw new common_1.NotFoundException('Pieza no encontrada');
            if (piece.status === piece_status_enum_1.PieceStatus.CANCELLED)
                return piece;
            await this.designBudget.releaseForPiece(piece, `Cancelación (${cancel_origin_enum_1.CANCEL_ORIGIN_LABELS[origin]}): ${motivo}`, actorId, manager);
            piece.status = piece_status_enum_1.PieceStatus.CANCELLED;
            piece.cancelOrigin = origin;
            piece.cancelReason = motivo.slice(0, 500);
            piece.cancelledAt = new Date();
            piece.cancelledBy = actorId;
            return manager.save(piece_entity_1.Piece, piece);
        });
    }
};
exports.CancelPieceUseCase = CancelPieceUseCase;
exports.CancelPieceUseCase = CancelPieceUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(piece_entity_1.Piece)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        design_budget_service_1.DesignBudgetService])
], CancelPieceUseCase);
