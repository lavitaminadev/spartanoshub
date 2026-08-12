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
exports.ListContentGridsUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const content_grid_entity_1 = require("./content-grid.entity");
let ListContentGridsUseCase = class ListContentGridsUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(organizationId, clientId, month, clientVisibleOnly = false, clientIds) {
        const where = { organizationId };
        if (clientId)
            where.clientId = clientId;
        if (!clientId && clientIds !== undefined)
            where.clientId = (0, typeorm_2.In)(clientIds);
        const hasMonthFilter = !!month && /^\d{4}-\d{2}$/.test(month);
        const grids = await this.repo.find({
            where,
            order: { weekStart: 'DESC' },
            relations: ['contentItems', 'client'],
            take: hasMonthFilter ? undefined : 200,
        });
        const visibleGrids = clientVisibleOnly
            ? grids.filter((grid) => ['submitted', 'approved', 'published'].includes(grid.status))
            : grids;
        if (!month || !/^\d{4}-\d{2}$/.test(month))
            return visibleGrids;
        const start = new Date(`${month}-01T00:00:00.000Z`);
        const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
        return visibleGrids.filter((grid) => new Date(grid.weekStart) < end && new Date(grid.weekEnd) >= start);
    }
};
exports.ListContentGridsUseCase = ListContentGridsUseCase;
exports.ListContentGridsUseCase = ListContentGridsUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(content_grid_entity_1.ContentGrid)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ListContentGridsUseCase);
