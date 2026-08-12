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
exports.GetOperationsOverviewUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let GetOperationsOverviewUseCase = class GetOperationsOverviewUseCase {
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async execute(organizationId) {
        const memberRows = await this.dataSource.query(`SELECT u.id, u.name, u.role,
        COUNT(p.id) as currentPieces,
        COALESCE(SUM(p.ud_amount), 0) as currentLoad,
        u.weekly_capacity_ud as capacity
       FROM users u
       LEFT JOIN pieces p ON p.assigned_to = u.id AND p.organization_id = u.organization_id
         AND p.status NOT IN ('delivered','cancelled')
       WHERE u.organization_id = ? AND u.is_active = 1
       GROUP BY u.id, u.name, u.role, u.weekly_capacity_ud
       ORDER BY u.name ASC`, [organizationId]);
        const team = memberRows.map((member) => ({
            ...member,
            currentPieces: Number(member.currentPieces),
            currentLoad: Number(member.currentLoad),
            capacity: Number(member.capacity),
        }));
        const totalCapacity = team.reduce((sum, member) => sum + member.capacity, 0);
        const usedCapacity = team.reduce((sum, member) => sum + member.currentLoad, 0);
        const podRows = await this.dataSource.query(`SELECT pod.id, pod.name, pod.status, pod.monthly_capacity_ud AS capacity,
              leader.name AS leaderName,
              (SELECT COUNT(*) FROM pod_members pm WHERE pm.pod_id = pod.id) AS memberCount,
              (SELECT COUNT(*) FROM clients c WHERE c.pod_id = pod.id AND c.organization_id = pod.organization_id) AS clientCount,
              (SELECT COALESCE(SUM(p.ud_amount), 0) FROM pieces p
                 WHERE p.organization_id = pod.organization_id
                   AND p.client_id IN (SELECT c2.id FROM clients c2 WHERE c2.pod_id = pod.id)
                   AND p.status NOT IN ('delivered','cancelled')) AS currentLoad
       FROM pods pod LEFT JOIN users leader ON leader.id = pod.leader_id
       WHERE pod.organization_id = ? AND pod.status <> 'archived'
       ORDER BY pod.name ASC`, [organizationId]);
        const pods = podRows.map((pod) => ({
            ...pod,
            capacity: Number(pod.capacity), memberCount: Number(pod.memberCount), clientCount: Number(pod.clientCount), currentLoad: Number(pod.currentLoad),
        }));
        return { pods, team, totalCapacity, usedCapacity };
    }
};
exports.GetOperationsOverviewUseCase = GetOperationsOverviewUseCase;
exports.GetOperationsOverviewUseCase = GetOperationsOverviewUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], GetOperationsOverviewUseCase);
//# sourceMappingURL=get-operations-overview.use-case.js.map