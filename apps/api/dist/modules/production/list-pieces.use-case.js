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
exports.ListPiecesUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const piece_entity_1 = require("./piece.entity");
let ListPiecesUseCase = class ListPiecesUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(organizationId, status, clientId, assignedTo, clientIds, page = 1, limit = 300) {
        const where = { organizationId };
        if (status)
            where.status = status;
        if (clientId)
            where.clientId = clientId;
        if (!clientId && clientIds !== undefined)
            where.clientId = (0, typeorm_2.In)(clientIds);
        if (assignedTo)
            where.assignedTo = assignedTo;
        const pieces = await this.repo.find({
            where,
            order: { createdAt: 'DESC' },
            relations: ['client'],
            skip: (page - 1) * limit,
            take: limit,
        });
        return pieces.map((piece) => ({
            id: piece.id,
            title: piece.title,
            type: piece.type,
            status: piece.status,
            udAmount: Number(piece.udAmount ?? 0),
            correctionCount: piece.correctionCount,
            clientCorrectionCount: piece.clientCorrectionCount,
            chargeNoteRequired: piece.clientCorrectionCount > 3,
            clientName: piece.client?.name || 'Sin cliente',
            assignedTo: piece.assignedTo,
            dueDate: piece.deadlineAt?.toISOString(),
            dependencyIds: piece.dependencyIds ?? [],
            createdAt: piece.createdAt.toISOString(),
            assignedAt: piece.assignedAt?.toISOString(),
            difficultyLevel: piece.difficultyLevel,
        }));
    }
};
exports.ListPiecesUseCase = ListPiecesUseCase;
exports.ListPiecesUseCase = ListPiecesUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(piece_entity_1.Piece)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ListPiecesUseCase);
//# sourceMappingURL=list-pieces.use-case.js.map