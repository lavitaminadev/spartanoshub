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
exports.DeliverPieceUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const piece_entity_1 = require("./piece.entity");
const piece_status_enum_1 = require("./piece-status.enum");
const event_emitter_1 = require("@nestjs/event-emitter");
const design_budget_service_1 = require("../design-budget/design-budget.service");
const xp_service_1 = require("../gamification/xp.service");
let DeliverPieceUseCase = class DeliverPieceUseCase {
    constructor(repo, designBudget, xp, eventEmitter) {
        this.repo = repo;
        this.designBudget = designBudget;
        this.xp = xp;
        this.eventEmitter = eventEmitter;
    }
    async execute(pieceId, organizationId, actorId) {
        const saved = await this.repo.manager.transaction(async (manager) => {
            const piece = await manager.findOne(piece_entity_1.Piece, { where: { id: pieceId, organizationId } });
            if (!piece)
                throw new common_1.NotFoundException('Pieza no encontrada');
            if (piece.status !== piece_status_enum_1.PieceStatus.APPROVED)
                throw new common_1.BadRequestException('La pieza debe estar aprobada antes de entregarse');
            const deliveredAt = new Date();
            piece.status = piece_status_enum_1.PieceStatus.DELIVERED;
            piece.deliveredAt = deliveredAt;
            const deliveredPiece = await manager.save(piece_entity_1.Piece, piece);
            await this.designBudget.confirmConsumption(deliveredPiece, actorId, manager);
            if (deliveredPiece.assignedTo) {
                await this.xp.registerDelivery(deliveredPiece, deliveredPiece.assignedTo, deliveredAt, manager);
            }
            return deliveredPiece;
        });
        this.eventEmitter.emit('piece.delivered', { organizationId, pieceId: saved.id });
        return saved;
    }
};
exports.DeliverPieceUseCase = DeliverPieceUseCase;
exports.DeliverPieceUseCase = DeliverPieceUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(piece_entity_1.Piece)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        design_budget_service_1.DesignBudgetService,
        xp_service_1.XPService,
        event_emitter_1.EventEmitter2])
], DeliverPieceUseCase);
