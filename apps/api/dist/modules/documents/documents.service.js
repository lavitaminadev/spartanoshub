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
exports.DocumentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const document_entity_1 = require("./document.entity");
const client_entity_1 = require("../clients/client.entity");
let DocumentsService = class DocumentsService {
    constructor(repo, clients) {
        this.repo = repo;
        this.clients = clients;
    }
    async create(dto, organizationId, userId) {
        const client = await this.clients.findOne({ where: { id: dto.clientId, organizationId } });
        if (!client)
            throw new common_1.BadRequestException('El cliente no pertenece a esta organización');
        const doc = this.repo.create({ ...dto, organizationId, uploadedBy: userId, name: dto.name.trim(), type: dto.type?.trim().toLowerCase() || 'other', tags: dto.tags?.map((tag) => tag.trim().toLowerCase()).filter(Boolean) });
        return this.repo.save(doc);
    }
    async findAll(organizationId, limit = 50, offset = 0, clientIds) {
        const where = { organizationId };
        if (clientIds !== undefined)
            where.clientId = (0, typeorm_2.In)(clientIds);
        const [data, total] = await this.repo.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            take: limit,
            skip: offset,
        });
        return { data, total, limit, offset };
    }
    async findOne(id, organizationId, clientIds) {
        if (clientIds?.length === 0)
            throw new common_1.NotFoundException('Document not found');
        const doc = await this.repo.findOne({
            where: { id, organizationId, ...(clientIds !== undefined ? { clientId: (0, typeorm_2.In)(clientIds) } : {}) },
        });
        if (!doc)
            throw new common_1.NotFoundException('Document not found');
        return doc;
    }
    async update(id, dto, organizationId) {
        const doc = await this.findOne(id, organizationId);
        if (dto.clientId) {
            const client = await this.clients.findOne({ where: { id: dto.clientId, organizationId } });
            if (!client)
                throw new common_1.BadRequestException('El cliente no pertenece a esta organización');
        }
        Object.assign(doc, dto);
        if (dto.name !== undefined)
            doc.name = dto.name.trim();
        if (dto.type !== undefined)
            doc.type = dto.type.trim().toLowerCase();
        if (dto.tags !== undefined)
            doc.tags = dto.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
        return this.repo.save(doc);
    }
    async remove(id, organizationId) {
        const doc = await this.findOne(id, organizationId);
        return this.repo.remove(doc);
    }
};
exports.DocumentsService = DocumentsService;
exports.DocumentsService = DocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(document_entity_1.Document)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], DocumentsService);
