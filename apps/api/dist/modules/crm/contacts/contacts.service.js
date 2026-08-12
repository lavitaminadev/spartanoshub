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
exports.ContactsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const contact_entity_1 = require("./contact.entity");
const EMPTY_SCOPE = Symbol('empty-client-scope');
function buildSegments(counts) {
    return [
        { id: 'total', label: 'Todos los contactos', count: counts.total },
        { id: 'frequent', label: 'Clientes frecuentes (3+ reservas)', count: counts.frequent },
        { id: 'vip', label: 'Clientes VIP (5+ asistencias)', count: counts.vip },
        { id: 'inactive_90d', label: 'No visitan hace 90 días', count: counts.inactive90 },
    ];
}
const EMPTY_SEGMENTS = buildSegments({ total: 0, frequent: 0, vip: 0, inactive90: 0 });
let ContactsService = class ContactsService {
    constructor(repo, dataSource) {
        this.repo = repo;
        this.dataSource = dataSource;
    }
    async findAll(organizationId, limit = 50, offset = 0, clientId, allowedClientIds) {
        const scope = this.clientScope(clientId, allowedClientIds);
        if (scope === EMPTY_SCOPE)
            return { data: [], total: 0, limit, offset };
        const [data, total] = await this.repo.findAndCount({
            where: scope ? { organizationId, clientId: scope } : { organizationId },
            order: { createdAt: 'DESC' },
            take: limit,
            skip: offset,
        });
        return { data, total, limit, offset };
    }
    async findOne(id, organizationId, allowedClientIds) {
        const contact = await this.repo.findOne({ where: { id, organizationId } });
        if (!contact)
            throw new common_1.NotFoundException('Contact not found');
        if (allowedClientIds !== undefined && (!contact.clientId || !allowedClientIds.includes(contact.clientId))) {
            throw new common_1.NotFoundException('Contact not found');
        }
        return contact;
    }
    clientScope(clientId, allowedClientIds) {
        if (allowedClientIds === undefined)
            return clientId;
        if (allowedClientIds.length === 0)
            return EMPTY_SCOPE;
        if (clientId)
            return allowedClientIds.includes(clientId) ? clientId : EMPTY_SCOPE;
        return (0, typeorm_2.In)(allowedClientIds);
    }
    async update(id, dto, organizationId, allowedClientIds) {
        const contact = await this.findOne(id, organizationId, allowedClientIds);
        if (dto.position !== undefined)
            contact.position = dto.position.trim() || undefined;
        if (dto.notes !== undefined)
            contact.notes = dto.notes.trim() || undefined;
        return this.repo.save(contact);
    }
    async segments(organizationId, clientId, allowedClientIds) {
        const scope = this.clientScope(clientId, allowedClientIds);
        if (scope === EMPTY_SCOPE)
            return EMPTY_SEGMENTS;
        const scopedIds = clientId ? [clientId] : allowedClientIds;
        const clientFilter = scopedIds ? `AND l.client_id IN (${scopedIds.map(() => '?').join(',')})` : '';
        const params = scopedIds ? [organizationId, ...scopedIds] : [organizationId];
        const [row] = await this.dataSource.query(`SELECT
         COUNT(*) total,
         SUM(t.reservations >= 3) frequent,
         SUM(t.attended >= 5) vip,
         SUM(t.last_visit IS NOT NULL AND t.last_visit < DATE_SUB(NOW(), INTERVAL 90 DAY)) inactive90
       FROM (
         SELECT l.id,
                COUNT(r.id) reservations,
                SUM(r.status = 'attended') attended,
                MAX(r.starts_at) last_visit
         FROM leads l
         LEFT JOIN crm_contacts c ON c.lead_id = l.id
         LEFT JOIN reservations r ON r.contact_id = c.id AND r.status NOT LIKE 'cancelled%'
         WHERE l.organization_id = ? AND l.domain = 'audience' ${clientFilter}
         GROUP BY l.id
       ) t`, params);
        return buildSegments({
            total: Number(row?.total ?? 0),
            frequent: Number(row?.frequent ?? 0),
            vip: Number(row?.vip ?? 0),
            inactive90: Number(row?.inactive90 ?? 0),
        });
    }
};
exports.ContactsService = ContactsService;
exports.ContactsService = ContactsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(contact_entity_1.Contact)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource])
], ContactsService);
//# sourceMappingURL=contacts.service.js.map