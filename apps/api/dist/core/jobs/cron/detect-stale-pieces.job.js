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
var DetectStalePiecesJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DetectStalePiecesJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const piece_entity_1 = require("../../../modules/production/piece.entity");
const piece_status_enum_1 = require("../../../modules/production/piece-status.enum");
const notification_entity_1 = require("../../notifications/notification.entity");
const parameter_resolver_service_1 = require("../../parameters/parameter-resolver.service");
const DEFAULT_STALE_HOURS = 48;
const ACTIVE_STATUSES = [
    piece_status_enum_1.PieceStatus.ASSIGNED,
    piece_status_enum_1.PieceStatus.IN_PROGRESS,
    piece_status_enum_1.PieceStatus.INTERNAL_REVIEW,
    piece_status_enum_1.PieceStatus.CLIENT_VALIDATION,
    piece_status_enum_1.PieceStatus.CORRECTION,
];
let DetectStalePiecesJob = DetectStalePiecesJob_1 = class DetectStalePiecesJob {
    constructor(pieceRepo, notifRepo, parameters) {
        this.pieceRepo = pieceRepo;
        this.notifRepo = notifRepo;
        this.parameters = parameters;
        this.logger = new common_1.Logger(DetectStalePiecesJob_1.name);
    }
    async handle() {
        this.logger.log('Detecting stale pieces...');
        const minimumCutoff = new Date(Date.now() - 3_600_000);
        const candidates = await this.pieceRepo
            .createQueryBuilder('p')
            .where('p.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
            .andWhere('p.updated_at < :minimumCutoff', { minimumCutoff })
            .getMany();
        const hoursByOrganization = new Map();
        let staleCount = 0;
        for (const piece of candidates) {
            try {
                let staleHours = hoursByOrganization.get(piece.organizationId);
                if (staleHours === undefined) {
                    const configured = await this.parameters.get('production.stale_hours', null, null, piece.organizationId);
                    staleHours = Number(configured ?? DEFAULT_STALE_HOURS);
                    hoursByOrganization.set(piece.organizationId, staleHours);
                }
                const cutoff = new Date(Date.now() - staleHours * 3_600_000);
                if (piece.updatedAt >= cutoff || (piece.staleAlertedAt && piece.staleAlertedAt >= cutoff))
                    continue;
                piece.staleAlertedAt = new Date();
                await this.pieceRepo.save(piece);
                staleCount += 1;
                if (!piece.assignedTo) {
                    this.logger.warn(`Stale piece without assignee: ${piece.id} - ${piece.title}`);
                    continue;
                }
                const notif = this.notifRepo.create({
                    userId: piece.assignedTo,
                    organizationId: piece.organizationId,
                    type: 'piece.stale',
                    title: 'Pieza estancada',
                    message: `La pieza "${piece.title}" lleva más de ${staleHours}h en estado "${piece.status}".`,
                    data: { pieceId: piece.id, status: piece.status, hoursStale: staleHours },
                });
                await this.notifRepo.save(notif);
                this.logger.warn(`Stale piece: ${piece.id} - ${piece.title} (${piece.status})`);
            }
            catch (error) {
                this.logger.error(`Failed to process stale piece ${piece.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        this.logger.log(`Found ${staleCount} stale pieces`);
    }
};
exports.DetectStalePiecesJob = DetectStalePiecesJob;
exports.DetectStalePiecesJob = DetectStalePiecesJob = DetectStalePiecesJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(piece_entity_1.Piece)),
    __param(1, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        parameter_resolver_service_1.ParameterResolver])
], DetectStalePiecesJob);
//# sourceMappingURL=detect-stale-pieces.job.js.map