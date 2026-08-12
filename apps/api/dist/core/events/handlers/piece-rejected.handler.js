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
var PieceRejectedHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PieceRejectedHandler = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const billing_service_1 = require("../../../modules/billing/billing.service");
const correction_entity_1 = require("../../../modules/production/correction.entity");
const piece_entity_1 = require("../../../modules/production/piece.entity");
let PieceRejectedHandler = PieceRejectedHandler_1 = class PieceRejectedHandler {
    constructor(corrections, pieces, billing) {
        this.corrections = corrections;
        this.pieces = pieces;
        this.billing = billing;
        this.logger = new common_1.Logger(PieceRejectedHandler_1.name);
    }
    async handle(payload) {
        try {
            const correction = await this.corrections.findOne({ where: { id: payload.correctionId, pieceId: payload.pieceId } });
            if (!correction?.chargeNoteRequired)
                return;
            const piece = await this.pieces.findOne({ where: { id: payload.pieceId, organizationId: payload.organizationId } });
            if (!piece)
                return;
            const existing = await this.corrections.manager.query('SELECT id FROM charge_notes WHERE correction_id = ? LIMIT 1', [correction.id]);
            if (existing.length)
                return;
            await this.billing.createCorrectionCharge({ organizationId: piece.organizationId, clientId: piece.clientId, pieceId: piece.id, correctionId: correction.id, correctionNumber: piece.clientCorrectionCount, createdBy: payload.requestedBy });
        }
        catch (error) {
            this.logger.error(`Error procesando piece.rejected para pieza ${payload.pieceId} / correccion ${payload.correctionId}: ${error instanceof Error ? error.message : error}`);
        }
    }
};
exports.PieceRejectedHandler = PieceRejectedHandler;
__decorate([
    (0, event_emitter_1.OnEvent)('piece.rejected'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PieceRejectedHandler.prototype, "handle", null);
exports.PieceRejectedHandler = PieceRejectedHandler = PieceRejectedHandler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(correction_entity_1.Correction)),
    __param(1, (0, typeorm_1.InjectRepository)(piece_entity_1.Piece)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        billing_service_1.BillingService])
], PieceRejectedHandler);
//# sourceMappingURL=piece-rejected.handler.js.map