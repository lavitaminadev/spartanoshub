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
exports.GetWeeklyRankingUseCase = void 0;
exports.getCurrentWeekStart = getCurrentWeekStart;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const xp_period_entity_1 = require("./xp-period.entity");
function getCurrentWeekStart(now = new Date()) {
    const weekStart = new Date(now);
    const daysSinceMonday = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - daysSinceMonday);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
}
let GetWeeklyRankingUseCase = class GetWeeklyRankingUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(organizationId) {
        const weekStart = getCurrentWeekStart();
        return this.repo.find({
            where: { organizationId, weekStart },
            order: { totalXp: 'DESC' },
            relations: ['user'],
        });
    }
};
exports.GetWeeklyRankingUseCase = GetWeeklyRankingUseCase;
exports.GetWeeklyRankingUseCase = GetWeeklyRankingUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(xp_period_entity_1.XPPeriod)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], GetWeeklyRankingUseCase);
//# sourceMappingURL=get-weekly-ranking.use-case.js.map