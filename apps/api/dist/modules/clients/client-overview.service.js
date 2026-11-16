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
const ud_movement_effect_1 = require("../design-budget/ud-movement-effect");
const client_capabilities_1 = require("./client-capabilities");
const CAPACIDAD_DE_LA_CIFRA = {
    pendingPieces: 'production',
    contentGrids: 'content',
    meetings: 'meetings',
    upcomingMeetings: 'meetings',
    documents: 'documents',
    contracts: 'contracts',
    activeContracts: 'contracts',
    briefs: 'briefs',
    approvedBriefs: 'briefs',
};
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
        const [recentPieces, recentMeetings, udMovementRows] = await Promise.all([
            this.dataSource.query('SELECT id, title, status, deadline_at AS deadlineAt, ud_amount AS udAmount FROM pieces WHERE organization_id = ? AND client_id = ? ORDER BY updated_at DESC LIMIT 5', [organizationId, clientId]),
            this.dataSource.query('SELECT id, title, type, status, scheduled_at AS scheduledAt FROM meetings WHERE organization_id = ? AND client_id = ? ORDER BY scheduled_at DESC LIMIT 5', [organizationId, clientId]),
            this.dataSource.query(`SELECT m.created_at AS date, m.type, m.amount, m.reason, p.title AS piece, u.name AS actor
           FROM ud_movements m
           JOIN ud_budgets b ON b.id = m.ud_budget_id
           LEFT JOIN pieces p ON p.id = m.piece_id
           LEFT JOIN users u ON u.id = m.actor_id
          WHERE b.client_id = ? AND b.year = YEAR(NOW()) AND b.month = MONTH(NOW())
          ORDER BY m.created_at DESC
          LIMIT 50`, [clientId]),
        ]);
        const statsRow = statsResult[0];
        const pieceStatuses = readJsonColumn(statsRow.piece_data)?.pieces || [];
        const udData = readJsonColumn(statsRow.ud_data) || {};
        const pendingPieces = pieceStatuses.reduce((sum, row) => ['delivered', 'cancelled'].includes(row.status) ? sum : sum + row.total, 0);
        const stats = {
            pendingPieces,
            contentGrids: Number(statsRow.content_grids ?? 0),
            meetings: Number(statsRow.meetings_total ?? 0),
            upcomingMeetings: Number(statsRow.upcoming_meetings ?? 0),
            documents: Number(statsRow.documents ?? 0),
            reservationForms: Number(statsRow.forms_total ?? 0),
            publishedForms: Number(statsRow.forms_published ?? 0),
            contracts: Number(statsRow.contracts_total ?? 0),
            activeContracts: Number(statsRow.contracts_active ?? 0),
            briefs: Number(statsRow.briefs_total ?? 0),
            approvedBriefs: Number(statsRow.briefs_approved ?? 0),
        };
        const contratado = (0, client_capabilities_1.normalizeClientCapabilities)(client.capabilities);
        for (const [cifra, capacidad] of Object.entries(CAPACIDAD_DE_LA_CIFRA)) {
            if (!contratado[capacidad])
                delete stats[cifra];
        }
        return {
            client,
            stats,
            ud: {
                contracted: Number(udData.contracted ?? 0),
                reserved: Number(udData.reserved ?? 0),
                consumed: Number(udData.consumed ?? 0),
            },
            udMovements: udMovementRows.map((row) => ({
                date: row.date,
                type: String(row.type),
                units: (0, ud_movement_effect_1.efectoEnElDisponible)(String(row.type), Number(row.amount)),
                piece: row.piece ?? null,
                reason: row.reason ?? null,
                actor: row.actor ?? null,
            })),
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
