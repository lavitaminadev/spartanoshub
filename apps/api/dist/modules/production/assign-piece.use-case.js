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
exports.AssignPieceUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const piece_entity_1 = require("./piece.entity");
const piece_status_enum_1 = require("./piece-status.enum");
const ud_calculator_1 = require("../design-budget/ud-calculator");
const event_emitter_1 = require("@nestjs/event-emitter");
const design_budget_service_1 = require("../design-budget/design-budget.service");
const user_entity_1 = require("../users/user.entity");
let AssignPieceUseCase = class AssignPieceUseCase {
    constructor(repo, users, designBudget, eventEmitter) {
        this.repo = repo;
        this.users = users;
        this.designBudget = designBudget;
        this.eventEmitter = eventEmitter;
    }
    async execute(pieceId, designerId, organizationId, actorId) {
        const saved = await this.repo.manager.transaction(async (manager) => {
            const piece = await manager.findOne(piece_entity_1.Piece, {
                where: { id: pieceId, organizationId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!piece)
                throw new common_1.NotFoundException('Pieza no encontrada');
            if (piece.status === piece_status_enum_1.PieceStatus.DELIVERED)
                throw new common_1.BadRequestException('Una pieza entregada no se puede reasignar');
            const assignee = await manager.findOne(user_entity_1.User, { where: { id: designerId, organizationId, isActive: true } });
            if (!assignee || !['designer', 'audiovisual', 'art_director'].includes(assignee.role)) {
                throw new common_1.BadRequestException('El responsable debe ser un usuario creativo activo de esta organizacion');
            }
            piece.assignedTo = designerId;
            piece.assignedAt = new Date();
            piece.startedAt = undefined;
            piece.status = piece_status_enum_1.PieceStatus.ASSIGNED;
            if (Number(piece.udAmount) <= 0)
                piece.udAmount = (0, ud_calculator_1.calculatePieceUd)(piece.type);
            const assignedPiece = await manager.save(piece_entity_1.Piece, piece);
            await this.designBudget.reserveForPiece(assignedPiece, actorId, manager);
            return assignedPiece;
        });
        this.eventEmitter.emit('piece.assigned', { organizationId, pieceId: saved.id, designerId });
        return saved;
    }
};
exports.AssignPieceUseCase = AssignPieceUseCase;
exports.AssignPieceUseCase = AssignPieceUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(piece_entity_1.Piece)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        design_budget_service_1.DesignBudgetService,
        event_emitter_1.EventEmitter2])
], AssignPieceUseCase);
