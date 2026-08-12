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
exports.SubmitVersionUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const piece_entity_1 = require("./piece.entity");
const piece_version_entity_1 = require("./piece-version.entity");
const piece_status_enum_1 = require("./piece-status.enum");
const naming_validator_1 = require("./naming-validator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const parameter_resolver_service_1 = require("../../core/parameters/parameter-resolver.service");
let SubmitVersionUseCase = class SubmitVersionUseCase {
    constructor(pieceRepo, versionRepo, parameters) {
        this.pieceRepo = pieceRepo;
        this.versionRepo = versionRepo;
        this.parameters = parameters;
    }
    async execute(pieceId, organizationId, data) {
        const piece = await this.pieceRepo.findOne({ where: { id: pieceId, organizationId }, relations: ['client'] });
        if (!piece)
            throw new common_1.NotFoundException('Pieza no encontrada');
        if ([user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL].includes(data.role) && piece.assignedTo !== data.userId) {
            throw new common_1.ForbiddenException('Solo el responsable asignado puede enviar una versión');
        }
        if (![piece_status_enum_1.PieceStatus.IN_PROGRESS, piece_status_enum_1.PieceStatus.CORRECTION].includes(piece.status)) {
            throw new common_1.BadRequestException('La pieza debe estar en progreso o corrección para enviar una versión');
        }
        const versions = await this.versionRepo.find({ where: { pieceId }, order: { versionNumber: 'DESC' }, take: 1 });
        const finalImmutable = await this.parameters.get('documents.final_immutable', piece.clientId, null, organizationId);
        if (versions[0]?.isFinal && finalImmutable !== false) {
            throw new common_1.BadRequestException('La última versión es FINAL e inmutable. Crea una nueva pieza para cambios posteriores');
        }
        const nextVersion = (versions[0]?.versionNumber ?? 0) + 1;
        const clientCode = piece?.client?.name?.substring(0, 4).toUpperCase() || '';
        const namingResult = (0, naming_validator_1.validate)(data.fileName, clientCode);
        const state = (0, naming_validator_1.extractState)(data.fileName);
        const version = this.versionRepo.create({
            pieceId,
            versionNumber: nextVersion,
            fileName: data.fileName,
            driveFileId: data.driveFileId,
            createdBy: data.userId,
            namingValid: namingResult.isValid,
            namingErrors: namingResult.errors.length > 0 ? namingResult.errors : undefined,
            stateLabel: state ?? undefined,
            isFinal: state === 'FINAL',
        });
        piece.status = piece_status_enum_1.PieceStatus.INTERNAL_REVIEW;
        await this.pieceRepo.save(piece);
        return this.versionRepo.save(version);
    }
};
exports.SubmitVersionUseCase = SubmitVersionUseCase;
exports.SubmitVersionUseCase = SubmitVersionUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(piece_entity_1.Piece)),
    __param(1, (0, typeorm_1.InjectRepository)(piece_version_entity_1.PieceVersion)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        parameter_resolver_service_1.ParameterResolver])
], SubmitVersionUseCase);
//# sourceMappingURL=submit-version.use-case.js.map