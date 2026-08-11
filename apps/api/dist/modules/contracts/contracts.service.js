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
exports.ContractsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const contract_entity_1 = require("./contract.entity");
const client_entity_1 = require("../clients/client.entity");
let ContractsService = class ContractsService {
    constructor(repo, clients) {
        this.repo = repo;
        this.clients = clients;
    }
    async create(dto, organizationId) {
        const client = await this.clients.findOne({ where: { id: dto.clientId, organizationId } });
        if (!client)
            throw new common_1.BadRequestException('El cliente no pertenece a esta organización');
        const startDate = new Date(dto.startDate);
        const endDate = dto.endDate ? new Date(dto.endDate) : undefined;
        if (endDate && endDate < startDate)
            throw new common_1.BadRequestException('La fecha de término no puede ser anterior al inicio');
        const contract = this.repo.create({
            ...dto,
            organizationId,
            name: dto.name.trim(),
            serviceType: dto.serviceType?.trim() || undefined,
            startDate,
            endDate,
        });
        const saved = await this.repo.save(contract);
        if (saved.status === 'active') {
            client.defaultUdBudget = Number(saved.monthlyUd || client.defaultUdBudget);
            if (Number(saved.monthlyPrice) > 0)
                client.retainerAmount = Number(saved.monthlyPrice);
            await this.clients.save(client);
        }
        return saved;
    }
    async findAll(organizationId, limit = 50, offset = 0) {
        const [data, total] = await this.repo.findAndCount({
            where: { organizationId },
            order: { createdAt: 'DESC' },
            relations: ['client'],
            take: limit,
            skip: offset,
        });
        return { data, total, limit, offset };
    }
    async findOne(id, organizationId) {
        const contract = await this.repo.findOne({ where: { id, organizationId }, relations: ['client'] });
        if (!contract)
            throw new common_1.NotFoundException('Contract not found');
        return contract;
    }
    async update(id, dto, organizationId) {
        const contract = await this.findOne(id, organizationId);
        const endDate = dto.endDate ? new Date(dto.endDate) : contract.endDate;
        if (endDate && endDate < new Date(contract.startDate))
            throw new common_1.BadRequestException('La fecha de término no puede ser anterior al inicio');
        Object.assign(contract, dto);
        if (dto.name !== undefined)
            contract.name = dto.name.trim();
        if (dto.serviceType !== undefined)
            contract.serviceType = dto.serviceType.trim() || undefined;
        if (dto.endDate !== undefined)
            contract.endDate = endDate;
        const saved = await this.repo.save(contract);
        if (saved.clientId && saved.status === 'active') {
            const client = await this.clients.findOne({ where: { id: saved.clientId, organizationId } });
            if (client) {
                client.defaultUdBudget = Number(saved.monthlyUd || client.defaultUdBudget);
                if (Number(saved.monthlyPrice) > 0)
                    client.retainerAmount = Number(saved.monthlyPrice);
                await this.clients.save(client);
            }
        }
        return saved;
    }
    async remove(id, organizationId) {
        const contract = await this.findOne(id, organizationId);
        return this.repo.remove(contract);
    }
};
exports.ContractsService = ContractsService;
exports.ContractsService = ContractsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(contract_entity_1.Contract)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ContractsService);
//# sourceMappingURL=contracts.service.js.map