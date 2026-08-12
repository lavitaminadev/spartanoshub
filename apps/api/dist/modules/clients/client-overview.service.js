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
exports.ClientOverviewService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const client_entity_1 = require("./client.entity");
function readJsonColumn(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'object')
        return value;
    try {
        return JSON.parse(String(value));
    }
    catch {
        return null;
    }
}
let ClientOverviewService = class ClientOverviewService {
    constructor(clients, dataSource) {
        this.clients = clients;
        this.dataSource = dataSource;
    }
    async getOverview(clientId, organizationId) {
        const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
        if (!client)
            throw new Error('Client not found');
        const statsResult = await this.dataSource.query(`
      SELECT
        (SELECT JSON_OBJECT('pieces', (
          SELECT JSON_ARRAYAGG(JSON_OBJECT('status', grouped.status, 'total', grouped.total))
          FROM (
            SELECT status, COUNT(*) AS total
            FROM pieces WHERE organization_id = ? AND client_id = ? GROUP BY status
          ) AS grouped
        ))) AS piece_data,
        (SELECT COUNT(*) FROM content_grids WHERE organization_id = ? AND client_id = ?) AS content_grids,
        (SELECT COUNT(*) FROM meetings WHERE organization_id = ? AND client_id = ?) AS meetings_total,
        (SELECT COUNT(*) FROM meetings WHERE organization_id = ? AND client_id = ? AND scheduled_at >= NOW()) AS upcoming_meetings,
        (SELECT COUNT(*) FROM documents WHERE organization_id = ? AND client_id = ?) AS documents,
        (SELECT COUNT(*) FROM reservation_forms WHERE organization_id = ? AND client_id = ?) AS forms_total,
        (SELECT COUNT(*) FROM reservation_forms WHERE organization_id = ? AND client_id = ? AND status = 'published') AS forms_published,
        (SELECT COUNT(*) FROM contracts WHERE organization_id = ? AND client_id = ?) AS contracts_total,
        (SELECT COUNT(*) FROM contracts WHERE organization_id = ? AND client_id = ? AND status = 'active') AS contracts_active,
        (SELECT COUNT(*) FROM briefs WHERE organization_id = ? AND client_id = ?) AS briefs_total,
        (SELECT COUNT(*) FROM briefs WHERE organization_id = ? AND client_id = ? AND status = 'approved') AS briefs_approved,
        (SELECT JSON_OBJECT('contracted', COALESCE(SUM(contracted), 0), 'reserved', COALESCE(SUM(reserved), 0), 'consumed', COALESCE(SUM(consumed), 0))
         FROM ud_budgets WHERE client_id = ? AND year = YEAR(NOW()) AND month = MONTH(NOW())) AS ud_data
    `, [
            organizationId, clientId,
            organizationId, clientId,
            organizationId, clientId, organizationId, clientId,
            organizationId, clientId,
            organizationId, clientId, organizationId, clientId,
            organizationId, clientId, organizationId, clientId,
            organizationId, clientId, organizationId, clientId,
            clientId,
        ]);
        const [recentPieces, recentMeetings] = await Promise.all([
            this.dataSource.query('SELECT id, title, status, deadline_at AS deadlineAt, ud_amount AS udAmount FROM pieces WHERE organization_id = ? AND client_id = ? ORDER BY updated_at DESC LIMIT 5', [organizationId, clientId]),
            this.dataSource.query('SELECT id, title, type, status, scheduled_at AS scheduledAt FROM meetings WHERE organization_id = ? AND client_id = ? ORDER BY scheduled_at DESC LIMIT 5', [organizationId, clientId]),
        ]);
        const stats = statsResult[0];
        const pieceStatuses = readJsonColumn(stats.piece_data)?.pieces || [];
        const udData = readJsonColumn(stats.ud_data) || {};
        const pendingPieces = pieceStatuses.reduce((sum, row) => ['delivered', 'cancelled'].includes(row.status) ? sum : sum + row.total, 0);
        return {
            client,
            stats: {
                pendingPieces,
                contentGrids: Number(stats.content_grids ?? 0),
                meetings: Number(stats.meetings_total ?? 0),
                upcomingMeetings: Number(stats.upcoming_meetings ?? 0),
                documents: Number(stats.documents ?? 0),
                reservationForms: Number(stats.forms_total ?? 0),
                publishedForms: Number(stats.forms_published ?? 0),
                contracts: Number(stats.contracts_total ?? 0),
                activeContracts: Number(stats.contracts_active ?? 0),
                briefs: Number(stats.briefs_total ?? 0),
                approvedBriefs: Number(stats.briefs_approved ?? 0),
            },
            ud: {
                contracted: Number(udData.contracted ?? 0),
                reserved: Number(udData.reserved ?? 0),
                consumed: Number(udData.consumed ?? 0),
            },
            pieceStatuses: pieceStatuses.map((row) => ({ status: row.status, total: row.total })),
            recentPieces,
            recentMeetings,
        };
    }
};
exports.ClientOverviewService = ClientOverviewService;
exports.ClientOverviewService = ClientOverviewService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource])
], ClientOverviewService);
