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
var PieceDeliveredHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PieceDeliveredHandler = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const piece_entity_1 = require("../../../modules/production/piece.entity");
const piece_version_entity_1 = require("../../../modules/production/piece-version.entity");
const client_entity_1 = require("../../../modules/clients/client.entity");
const notification_entity_1 = require("../../notifications/notification.entity");
let PieceDeliveredHandler = PieceDeliveredHandler_1 = class PieceDeliveredHandler {
    constructor(pieceRepo, versionRepo, clientRepo, notifRepo) {
        this.pieceRepo = pieceRepo;
        this.versionRepo = versionRepo;
        this.clientRepo = clientRepo;
        this.notifRepo = notifRepo;
        this.logger = new common_1.Logger(PieceDeliveredHandler_1.name);
    }
    async handle(payload) {
        try {
            const piece = await this.pieceRepo.findOne({ where: { id: payload.pieceId, organizationId: payload.organizationId } });
            if (!piece)
                return;
            const latestVersion = await this.versionRepo.findOne({
                where: { pieceId: piece.id },
                order: { versionNumber: 'DESC' },
            });
            if (latestVersion) {
                const isValid = /^[A-Z0-9]+_[A-Z-]+_[A-Z0-9-]+_v\d+_(FINAL|BORRADOR|REVISION)$/i.test(latestVersion.fileName);
                latestVersion.namingValid = isValid;
                latestVersion.namingErrors = isValid ? [] : ['El nombre del archivo no sigue la convencion establecida'];
                await this.versionRepo.save(latestVersion);
            }
            const period = piece.deliveredAt ?? new Date();
            const [remaining] = await this.pieceRepo.manager.query("SELECT COUNT(*) total FROM pieces WHERE organization_id = ? AND client_id = ? AND YEAR(created_at) = ? AND MONTH(created_at) = ? AND status <> 'delivered'", [piece.organizationId, piece.clientId, period.getFullYear(), period.getMonth() + 1]);
            await this.pieceRepo.manager.query('UPDATE account_cycles SET production_status = ? WHERE organization_id = ? AND client_id = ? AND year = ? AND month = ?', [Number(remaining?.total ?? 0) === 0 ? 'completed' : 'in_progress', piece.organizationId, piece.clientId, period.getFullYear(), period.getMonth() + 1]);
            const client = await this.clientRepo.findOne({ where: { id: piece.clientId, organizationId: piece.organizationId } });
            if (!client?.communityManagerId)
                return;
            await this.notifRepo.save(this.notifRepo.create({
                organizationId: piece.organizationId,
                userId: client.communityManagerId,
                type: 'piece.delivered',
                title: 'Pieza entregada',
                message: `La pieza "${piece.title}" ha sido entregada al cliente.`,
                data: { pieceId: piece.id, clientId: piece.clientId },
            }));
        }
        catch (error) {
            this.logger.error(`Error procesando piece.delivered para pieza ${payload.pieceId}: ${error instanceof Error ? error.message : error}`);
        }
    }
};
exports.PieceDeliveredHandler = PieceDeliveredHandler;
__decorate([
    (0, event_emitter_1.OnEvent)('piece.delivered'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PieceDeliveredHandler.prototype, "handle", null);
exports.PieceDeliveredHandler = PieceDeliveredHandler = PieceDeliveredHandler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(piece_entity_1.Piece)),
    __param(1, (0, typeorm_1.InjectRepository)(piece_version_entity_1.PieceVersion)),
    __param(2, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(3, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], PieceDeliveredHandler);
