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
exports.IngestSourcesController = exports.ToggleIngestSourceDto = exports.CreateIngestSourceDto = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../../../core/authorization/roles.decorator");
const module_scope_decorator_1 = require("../../../core/authorization/module-scope.decorator");
const user_role_enum_1 = require("../../organizations/user-role.enum");
const ingest_source_entity_1 = require("./ingest-source.entity");
const lead_ingest_service_1 = require("./lead-ingest.service");
class CreateIngestSourceDto {
}
exports.CreateIngestSourceDto = CreateIngestSourceDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateIngestSourceDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    (0, class_validator_1.Matches)(/^[a-z][a-z0-9_]*$/, { message: 'Usa minúsculas y guion bajo, por ejemplo `portal_inmobiliario`' }),
    __metadata("design:type", String)
], CreateIngestSourceDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateIngestSourceDto.prototype, "clientId", void 0);
class ToggleIngestSourceDto {
}
exports.ToggleIngestSourceDto = ToggleIngestSourceDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ToggleIngestSourceDto.prototype, "isActive", void 0);
let IngestSourcesController = class IngestSourcesController {
    constructor(sources, ingest) {
        this.sources = sources;
        this.ingest = ingest;
    }
    async list(req) {
        const filas = await this.sources.find({
            where: { organizationId: req.organizationId },
            order: { createdAt: 'DESC' },
        });
        return filas.map((fila) => ({
            id: fila.id,
            name: fila.name,
            source: fila.source,
            clientId: fila.clientId,
            campaignId: fila.campaignId,
            campaignName: fila.campaignName,
            isActive: fila.isActive,
            tokenHint: `…${fila.tokenHint}`,
            receivedCount: fila.receivedCount,
            lastReceivedAt: fila.lastReceivedAt,
            lastError: fila.lastError,
            lastErrorAt: fila.lastErrorAt,
            url: `${(process.env.API_PUBLIC_URL ?? '').replace(/\/$/, '')}/public/ingest/leads`,
        }));
    }
    async create(dto, req) {
        const { source, token } = await this.ingest.issueToken(this.sources.create({
            organizationId: req.organizationId,
            clientId: dto.clientId ?? null,
            name: dto.name.trim(),
            source: dto.source,
            isActive: true,
            createdBy: req.user.id,
        }));
        return {
            id: source.id,
            name: source.name,
            source: source.source,
            token,
            url: `${(process.env.API_PUBLIC_URL ?? '').replace(/\/$/, '')}/public/ingest/leads`,
            header: `Authorization: Bearer ${token}`,
            aviso: 'Copia la llave ahora: no se puede volver a ver. Si se pierde, se genera una nueva.',
        };
    }
    async rotate(id, req) {
        const source = await this.find(id, req.organizationId);
        const { token } = await this.ingest.issueToken(source);
        return {
            token,
            header: `Authorization: Bearer ${token}`,
            aviso: 'La llave anterior dejó de funcionar. Actualiza la integración antes de que lleguen más leads.',
        };
    }
    async toggle(id, dto, req) {
        const source = await this.find(id, req.organizationId);
        source.isActive = dto.isActive;
        await this.sources.save(source);
        return { id: source.id, isActive: source.isActive };
    }
    async find(id, organizationId) {
        const source = await this.sources.findOne({ where: { id, organizationId } });
        if (!source)
            throw new common_1.NotFoundException('Origen no encontrado');
        return source;
    }
};
exports.IngestSourcesController = IngestSourcesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Orígenes de entrada con su contador y último error' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IngestSourcesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Crear un origen y emitir su llave' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateIngestSourceDto, Object]),
    __metadata("design:returntype", Promise)
], IngestSourcesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/rotate'),
    (0, swagger_1.ApiOperation)({ summary: 'Reemplazar la llave de un origen' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], IngestSourcesController.prototype, "rotate", null);
__decorate([
    (0, common_1.Post)(':id/active'),
    (0, swagger_1.ApiOperation)({ summary: 'Encender o apagar un origen' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ToggleIngestSourceDto, Object]),
    __metadata("design:returntype", Promise)
], IngestSourcesController.prototype, "toggle", null);
exports.IngestSourcesController = IngestSourcesController = __decorate([
    (0, common_1.Controller)('crm/ingest-sources'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.DEV),
    (0, module_scope_decorator_1.ModuleScope)('integrations'),
    __param(0, (0, typeorm_1.InjectRepository)(ingest_source_entity_1.LeadIngestSource)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        lead_ingest_service_1.LeadIngestService])
], IngestSourcesController);
