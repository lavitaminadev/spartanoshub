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
exports.DashboardsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let DashboardsService = class DashboardsService {
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async getOverview(organizationId) {
        const [[clients], [contracts], [pieces], [users]] = await Promise.all([
            this.dataSource.query('SELECT COUNT(*) as total FROM clients WHERE organization_id = ?', [organizationId]),
            this.dataSource.query('SELECT COUNT(*) as total FROM contracts WHERE organization_id = ?', [organizationId]),
            this.dataSource.query('SELECT COUNT(*) as total FROM pieces WHERE organization_id = ?', [organizationId]),
            this.dataSource.query('SELECT COUNT(*) as total FROM users WHERE organization_id = ?', [organizationId]),
        ]);
        return {
            clients: clients?.total || 0,
            contracts: contracts?.total || 0,
            pieces: pieces?.total || 0,
            users: users?.total || 0,
        };
    }
    async getProduction(organizationId) {
        const [pieces, briefs] = await Promise.all([
            this.dataSource.query('SELECT status, COUNT(*) as count FROM pieces WHERE organization_id = ? GROUP BY status', [organizationId]),
            this.dataSource.query('SELECT status, COUNT(*) as count FROM briefs WHERE organization_id = ? GROUP BY status', [organizationId]),
        ]);
        return { pieces, briefs };
    }
    async getFinancial(organizationId) {
        const [[udStats], [contracts]] = await Promise.all([
            this.dataSource.query('SELECT COALESCE(SUM(contracted),0) as contracted, COALESCE(SUM(reserved),0) as reserved, COALESCE(SUM(consumed),0) as consumed FROM ud_budgets WHERE client_id IN (SELECT id FROM clients WHERE organization_id = ?)', [organizationId]),
            this.dataSource.query('SELECT COUNT(*) as total, COALESCE(SUM(monthly_ud),0) as total_monthly_ud FROM contracts WHERE organization_id = ?', [organizationId]),
        ]);
        return { ud: udStats, contracts };
    }
};
exports.DashboardsService = DashboardsService;
exports.DashboardsService = DashboardsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], DashboardsService);
//# sourceMappingURL=dashboards.service.js.map