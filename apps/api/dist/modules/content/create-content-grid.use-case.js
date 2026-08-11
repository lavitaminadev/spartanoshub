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
exports.CreateContentGridUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const content_grid_entity_1 = require("./content-grid.entity");
const client_entity_1 = require("../clients/client.entity");
let CreateContentGridUseCase = class CreateContentGridUseCase {
    constructor(repo, clients) {
        this.repo = repo;
        this.clients = clients;
    }
    async execute(data) {
        const client = await this.clients.findOne({ where: { id: data.clientId, organizationId: data.organizationId } });
        if (!client)
            throw new common_1.BadRequestException('El cliente no pertenece a esta organización');
        if (data.weekEnd < data.weekStart)
            throw new common_1.BadRequestException('El cierre de la parrilla no puede ser anterior al inicio');
        const grid = this.repo.create({ ...data, title: data.title.trim(), notes: data.notes?.trim() || undefined });
        return this.repo.save(grid);
    }
};
exports.CreateContentGridUseCase = CreateContentGridUseCase;
exports.CreateContentGridUseCase = CreateContentGridUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(content_grid_entity_1.ContentGrid)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], CreateContentGridUseCase);
//# sourceMappingURL=create-content-grid.use-case.js.map