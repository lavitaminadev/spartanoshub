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
var PieceAssignedHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PieceAssignedHandler = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const piece_entity_1 = require("../../../modules/production/piece.entity");
const notification_entity_1 = require("../../notifications/notification.entity");
let PieceAssignedHandler = PieceAssignedHandler_1 = class PieceAssignedHandler {
    constructor(pieceRepo, notifRepo) {
        this.pieceRepo = pieceRepo;
        this.notifRepo = notifRepo;
        this.logger = new common_1.Logger(PieceAssignedHandler_1.name);
    }
    async handle(payload) {
        try {
            const piece = await this.pieceRepo.findOne({ where: { id: payload.pieceId, organizationId: payload.organizationId } });
            if (!piece)
                return;
            await this.notifRepo.save(this.notifRepo.create({
                organizationId: piece.organizationId,
                userId: payload.designerId,
                type: 'piece.assigned',
                title: 'Nueva pieza asignada',
                message: `Se te ha asignado la pieza "${piece.title}".`,
                data: { pieceId: piece.id, clientId: piece.clientId },
            }));
        }
        catch (error) {
            this.logger.error(`Error procesando piece.assigned para pieza ${payload.pieceId}: ${error instanceof Error ? error.message : error}`);
        }
    }
};
exports.PieceAssignedHandler = PieceAssignedHandler;
__decorate([
    (0, event_emitter_1.OnEvent)('piece.assigned'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PieceAssignedHandler.prototype, "handle", null);
exports.PieceAssignedHandler = PieceAssignedHandler = PieceAssignedHandler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(piece_entity_1.Piece)),
    __param(1, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], PieceAssignedHandler);
//# sourceMappingURL=piece-assigned.handler.js.map