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
exports.ListApprovalsUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const approval_request_entity_1 = require("./approval-request.entity");
const piece_version_entity_1 = require("../production/piece-version.entity");
const MAX_APPROVALS = 200;
function buildVersionUrl(driveFileId) {
    if (!driveFileId)
        return undefined;
    return `https://drive.google.com/file/d/${driveFileId}/view`;
}
function groupBy(items, key) {
    const groups = new Map();
    for (const item of items) {
        const value = key(item);
        if (value === undefined)
            continue;
        const group = groups.get(value);
        if (group)
            group.push(item);
        else
            groups.set(value, [item]);
    }
    return groups;
}
let ListApprovalsUseCase = class ListApprovalsUseCase {
    constructor(repo, versionRepo) {
        this.repo = repo;
        this.versionRepo = versionRepo;
    }
    async execute(organizationId, clientId, clientIds) {
        const where = { organizationId };
        if (clientId)
            where.clientId = clientId;
        if (!clientId && clientIds !== undefined)
            where.clientId = (0, typeorm_2.In)(clientIds);
        const approvals = await this.repo.find({
            where,
            order: { createdAt: 'DESC' },
            relations: ['client', 'requestedByUser'],
            take: MAX_APPROVALS,
        });
        const pieceIds = [...new Set(approvals.filter((approval) => approval.entityType === 'piece').map((approval) => approval.entityId))];
        const versions = pieceIds.length ? await this.versionRepo.find({ where: { pieceId: (0, typeorm_2.In)(pieceIds) }, order: { versionNumber: 'DESC' } }) : [];
        const versionsByPiece = groupBy(versions, (version) => version.pieceId);
        const approvalsByEntity = groupBy(approvals, (approval) => approval.entityId);
        return approvals.map((a) => {
            const pieceVersions = versionsByPiece.get(a.entityId) ?? [];
            const latestVersion = pieceVersions[0];
            const decisionHistory = (approvalsByEntity.get(a.entityId) ?? []).map((related) => ({ id: related.id, status: related.status, notes: related.decisionNotes, requestedAt: related.createdAt.toISOString(), decidedAt: related.decisionAt?.toISOString(), requestedBy: related.requestedByUser?.name || 'Usuario no disponible' }));
            return {
                id: a.id,
                pieceId: a.entityId,
                pieceTitle: a.title,
                clientName: a.client?.name || 'Cliente sin nombre',
                requestedBy: a.requestedByUser?.name || 'Usuario no disponible',
                description: a.description,
                status: a.status,
                createdAt: a.createdAt.toISOString(),
                decisionNotes: a.decisionNotes,
                dueAt: a.dueAt?.toISOString(),
                versionUrl: buildVersionUrl(latestVersion?.driveFileId),
                versions: pieceVersions.map((version) => ({ id: version.id, number: version.versionNumber, fileName: version.fileName, url: buildVersionUrl(version.driveFileId), state: version.stateLabel, createdAt: version.createdAt.toISOString(), namingValid: version.namingValid })),
                decisionHistory,
            };
        });
    }
};
exports.ListApprovalsUseCase = ListApprovalsUseCase;
exports.ListApprovalsUseCase = ListApprovalsUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(approval_request_entity_1.ApprovalRequest)),
    __param(1, (0, typeorm_1.InjectRepository)(piece_version_entity_1.PieceVersion)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ListApprovalsUseCase);
//# sourceMappingURL=list-approvals.use-case.js.map