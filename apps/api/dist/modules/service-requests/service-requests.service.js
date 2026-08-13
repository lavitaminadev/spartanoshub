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
exports.ServiceRequestsService = exports.SERVICE_REQUEST_STATUSES = exports.SERVICE_REQUEST_TYPES = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const service_request_entity_1 = require("./service-request.entity");
const audit_service_1 = require("../../core/audit/audit.service");
const data_protection_service_1 = require("../../core/data-protection/data-protection.service");
const user_entity_1 = require("../users/user.entity");
const lead_entity_1 = require("../crm/leads/lead.entity");
const contact_entity_1 = require("../crm/contacts/contact.entity");
const reservation_entity_1 = require("../reservations/domain/reservation.entity");
exports.SERVICE_REQUEST_TYPES = [
    'account',
    'company',
    'rectification',
    'anonymization',
    'portability',
    'removal',
    'support',
];
exports.SERVICE_REQUEST_STATUSES = ['received', 'in_review', 'resolved', 'rejected', 'more_info'];
const SENSITIVE_TYPES = ['rectification', 'anonymization', 'portability', 'removal'];
let ServiceRequestsService = class ServiceRequestsService {
    constructor(requests, users, leads, contacts, reservations, audit, dataProtection) {
        this.requests = requests;
        this.users = users;
        this.leads = leads;
        this.contacts = contacts;
        this.reservations = reservations;
        this.audit = audit;
        this.dataProtection = dataProtection;
    }
    async createPublic(input) {
        const type = input.type.trim().toLowerCase();
        if (!exports.SERVICE_REQUEST_TYPES.includes(type))
            throw new common_1.BadRequestException('Tipo de solicitud no válido');
        const email = input.requesterEmail.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            throw new common_1.BadRequestException('El correo no es válido');
        if (!input.requesterName.trim())
            throw new common_1.BadRequestException('El nombre es obligatorio');
        const rut = input.requesterRut?.trim();
        if (SENSITIVE_TYPES.includes(type) && !rut) {
            throw new common_1.BadRequestException('Para este tipo de solicitud es obligatorio indicar tu RUT');
        }
        const saved = await this.requests.save(this.requests.create({
            organizationId: input.organizationId || null,
            type,
            status: 'received',
            requesterName: input.requesterName.trim(),
            requesterEmail: email,
            requesterRut: rut || null,
            requesterPhone: input.requesterPhone?.trim() || null,
            message: input.message?.trim() || null,
        }));
        return { id: saved.id, status: saved.status };
    }
    async findByStatus(email, rut) {
        const normalized = email.trim().toLowerCase();
        if (!rut?.trim())
            throw new common_1.BadRequestException('Para consultar el estado necesitas tu correo y tu RUT');
        const rows = await this.requests.find({
            where: { requesterEmail: normalized, requesterRut: rut.trim() },
            order: { createdAt: 'DESC' },
        });
        return rows.map((row) => ({
            id: row.id,
            type: row.type,
            status: row.status,
            message: row.message,
            resolutionNote: row.resolutionNote,
            createdAt: row.createdAt,
            resolvedAt: row.resolvedAt,
        }));
    }
    async list(organizationId, filter) {
        const where = { organizationId };
        if (filter?.status && exports.SERVICE_REQUEST_STATUSES.includes(filter.status))
            where.status = filter.status;
        if (filter?.type && exports.SERVICE_REQUEST_TYPES.includes(filter.type))
            where.type = filter.type;
        return this.requests.find({ where, order: { createdAt: 'DESC' }, take: 200 });
    }
    async getOne(organizationId, id) {
        const row = await this.requests.findOne({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException('La solicitud no existe');
        return row;
    }
    async resolve(organizationId, id, actor, body) {
        if (!exports.SERVICE_REQUEST_STATUSES.includes(body.status)) {
            throw new common_1.BadRequestException('Estado de resolución no válido');
        }
        const row = await this.getOne(organizationId, id);
        row.status = body.status;
        if (body.resolutionNote !== undefined)
            row.resolutionNote = body.resolutionNote.trim() || null;
        row.resolvedBy = actor.id;
        row.resolvedAt = new Date();
        const saved = await this.requests.save(row);
        await this.audit.log({
            organizationId,
            actorId: actor.id,
            entityType: 'ServiceRequest',
            entityId: id,
            action: 'resolved',
            before: { status: saved.status === body.status ? 'received' : undefined },
            after: { status: body.status, resolutionNote: body.resolutionNote },
        });
        return saved;
    }
    async anonymizeByIdentity(organizationId, id, actor) {
        const row = await this.getOne(organizationId, id);
        if (row.type !== 'anonymization' && row.type !== 'removal') {
            throw new common_1.BadRequestException('Esta solicitud no es de anonimización');
        }
        const email = row.requesterEmail.toLowerCase();
        const rut = row.requesterRut?.toLowerCase() || null;
        const reason = `Solicitud ${row.id}`;
        const matched = [];
        const users = await this.users.find({ where: { organizationId, email: (0, typeorm_2.In)([email]) } });
        for (const user of users) {
            await this.dataProtection.anonymizeUser(user.id);
            matched.push(`User:${user.id}`);
        }
        const leads = await this.leads.find({ where: { organizationId, email: (0, typeorm_2.In)([email]) } });
        for (const lead of leads) {
            await this.dataProtection.anonymizeLead(lead.id, organizationId, reason);
            matched.push(`Lead:${lead.id}`);
        }
        const contacts = await this.contacts.find({ where: { organizationId, email: (0, typeorm_2.In)([email]) } });
        for (const contact of contacts) {
            await this.dataProtection.anonymizeContact(contact.id, organizationId, reason);
            matched.push(`Contact:${contact.id}`);
        }
        const reservations = await this.reservations.find({ where: { organizationId, guestEmail: (0, typeorm_2.In)([email]) } });
        for (const reservation of reservations) {
            await this.dataProtection.anonymizeReservation(reservation.id, organizationId, reason);
            matched.push(`Reservation:${reservation.id}`);
        }
        row.status = 'resolved';
        row.resolutionNote = matched.length
            ? `Datos anonimizados (${matched.length} registros): ${matched.join(', ')}`
            : 'No se encontraron datos personales asociados a este correo.';
        row.resolvedBy = actor.id;
        row.resolvedAt = new Date();
        const saved = await this.requests.save(row);
        await this.audit.log({
            organizationId,
            actorId: actor.id,
            entityType: 'ServiceRequest',
            entityId: id,
            action: 'anonymized',
            before: { status: 'received' },
            after: { status: 'resolved', records: matched },
        });
        return saved;
    }
};
exports.ServiceRequestsService = ServiceRequestsService;
exports.ServiceRequestsService = ServiceRequestsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(service_request_entity_1.ServiceRequest)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(2, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __param(3, (0, typeorm_1.InjectRepository)(contact_entity_1.Contact)),
    __param(4, (0, typeorm_1.InjectRepository)(reservation_entity_1.Reservation)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        audit_service_1.AuditService,
        data_protection_service_1.DataProtectionService])
], ServiceRequestsService);
