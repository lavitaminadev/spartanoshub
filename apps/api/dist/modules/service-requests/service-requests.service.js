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
const phone_1 = require("../../shared/phone");
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
    async avisoPrivacidad(organizationId) {
        return this.dataProtection.avisoPrivacidadVigente(organizationId);
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
        if (input.privacyAccepted !== true) {
            throw new common_1.BadRequestException('Debes aceptar el aviso de privacidad para enviar la solicitud');
        }
        const rut = input.requesterRut?.trim();
        if (SENSITIVE_TYPES.includes(type) && !rut) {
            throw new common_1.BadRequestException('Para este tipo de solicitud es obligatorio indicar tu RUT');
        }
        const aviso = await this.dataProtection.avisoPrivacidadVigente(input.organizationId || '');
        const saved = await this.requests.save(this.requests.create({
            organizationId: input.organizationId || null,
            type,
            status: 'received',
            requesterName: input.requesterName.trim(),
            requesterEmail: email,
            requesterRut: rut || null,
            requesterPhone: input.requesterPhone?.trim() || null,
            message: input.message?.trim() || null,
            extra: {
                privacyAccepted: true,
                privacyAcceptedAt: new Date().toISOString(),
                privacyVersion: aviso.version,
                privacyVersionId: aviso.versionId,
                privacyProvisional: aviso.provisional,
            },
        }));
        return { id: saved.id, status: saved.status };
    }
    async findByReference(reference) {
        const ref = (reference ?? '').trim();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
            throw new common_1.BadRequestException('Ingresa el código de seguimiento que recibiste al enviar tu solicitud');
        }
        const row = await this.requests.findOne({ where: { id: ref } });
        if (!row)
            throw new common_1.NotFoundException('No encontramos una solicitud con ese código');
        return [{
                id: row.id,
                type: row.type,
                status: row.status,
                message: row.message,
                resolutionNote: row.resolutionNote,
                createdAt: row.createdAt,
                resolvedAt: row.resolvedAt,
            }];
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
    async update(organizationId, id, actor, body) {
        const row = await this.getOne(organizationId, id);
        const before = {
            type: row.type,
            status: row.status,
            requesterName: row.requesterName,
            requesterEmail: row.requesterEmail,
            requesterRut: row.requesterRut,
            requesterPhone: row.requesterPhone,
            message: row.message,
            resolutionNote: row.resolutionNote,
        };
        if (body.type !== undefined) {
            if (!exports.SERVICE_REQUEST_TYPES.includes(body.type))
                throw new common_1.BadRequestException('Tipo de solicitud no válido');
            row.type = body.type;
        }
        if (body.requesterName !== undefined) {
            if (!body.requesterName.trim())
                throw new common_1.BadRequestException('El nombre es obligatorio');
            row.requesterName = body.requesterName.trim();
        }
        if (body.requesterEmail !== undefined) {
            const email = body.requesterEmail.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                throw new common_1.BadRequestException('El correo no es válido');
            row.requesterEmail = email;
        }
        if (body.requesterRut !== undefined)
            row.requesterRut = body.requesterRut.trim() || null;
        if (body.requesterPhone !== undefined)
            row.requesterPhone = body.requesterPhone.trim() || null;
        if (body.message !== undefined)
            row.message = body.message.trim() || null;
        if (body.status !== undefined) {
            if (!exports.SERVICE_REQUEST_STATUSES.includes(body.status))
                throw new common_1.BadRequestException('Estado de resolución no válido');
            row.status = body.status;
            if (body.status === 'received' || body.status === 'in_review') {
                row.resolvedAt = null;
                row.resolvedBy = null;
            }
            else {
                row.resolvedBy = actor.id;
                row.resolvedAt = new Date();
            }
        }
        if (body.resolutionNote !== undefined)
            row.resolutionNote = body.resolutionNote.trim() || null;
        const saved = await this.requests.save(row);
        const after = {
            type: saved.type,
            status: saved.status,
            requesterName: saved.requesterName,
            requesterEmail: saved.requesterEmail,
            requesterRut: saved.requesterRut,
            requesterPhone: saved.requesterPhone,
            message: saved.message,
            resolutionNote: saved.resolutionNote,
        };
        await this.audit.log({
            organizationId,
            actorId: actor.id,
            entityType: 'ServiceRequest',
            entityId: id,
            action: 'updated',
            before,
            after,
        });
        return saved;
    }
    async resolve(organizationId, id, actor, body) {
        if (!exports.SERVICE_REQUEST_STATUSES.includes(body.status)) {
            throw new common_1.BadRequestException('Estado de resolución no válido');
        }
        const row = await this.getOne(organizationId, id);
        const before = { status: row.status, resolutionNote: row.resolutionNote };
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
            before,
            after: { status: saved.status, resolutionNote: saved.resolutionNote },
        });
        return saved;
    }
    async anonymizeByIdentity(organizationId, id, actor) {
        const row = await this.getOne(organizationId, id);
        if (row.type !== 'anonymization' && row.type !== 'removal') {
            throw new common_1.BadRequestException('Esta solicitud no es de anonimización');
        }
        const email = row.requesterEmail.toLowerCase();
        const phone = (0, phone_1.normalizePhone)(row.requesterPhone || '') || null;
        const previous = { status: row.status, resolutionNote: row.resolutionNote };
        const reason = `Solicitud ${row.id}`;
        const matched = [];
        const by = (emailField, phoneField) => {
            const criteria = [{ organizationId, [emailField]: (0, typeorm_2.In)([email]) }];
            if (phone)
                criteria.push({ organizationId, [phoneField]: (0, typeorm_2.In)([phone]) });
            return criteria;
        };
        const users = await this.users.find({ where: by('email', 'phone') });
        for (const user of users) {
            await this.dataProtection.anonymizeUser(user.id);
            matched.push(`User:${user.id}`);
        }
        const leads = await this.leads.find({ where: by('email', 'phone') });
        for (const lead of leads) {
            await this.dataProtection.anonymizeLead(lead.id, organizationId, reason);
            matched.push(`Lead:${lead.id}`);
        }
        const contacts = await this.contacts.find({ where: by('email', 'phone') });
        for (const contact of contacts) {
            await this.dataProtection.anonymizeContact(contact.id, organizationId, reason);
            matched.push(`Contact:${contact.id}`);
        }
        const reservations = await this.reservations.find({ where: by('guestEmail', 'guestPhone') });
        for (const reservation of reservations) {
            await this.dataProtection.anonymizeReservation(reservation.id, organizationId, reason);
            matched.push(`Reservation:${reservation.id}`);
        }
        const criterios = phone ? 'el correo y el teléfono declarados' : 'el correo declarado';
        if (matched.length === 0) {
            row.status = 'in_review';
            row.resolutionNote = `No se encontraron registros que coincidan con ${criterios}. `
                + 'Requiere revisión manual antes de responder: la persona puede haber entregado sus datos con otro contacto.';
            row.resolvedBy = null;
            row.resolvedAt = null;
        }
        else {
            row.status = 'resolved';
            row.resolutionNote = `Se anonimizaron ${matched.length} registros que coinciden con ${criterios}. `
                + 'Los registros asociados a otro correo o teléfono no quedan alcanzados por esta búsqueda.';
            row.resolvedBy = actor.id;
            row.resolvedAt = new Date();
        }
        const saved = await this.requests.save(row);
        await this.audit.log({
            organizationId,
            actorId: actor.id,
            entityType: 'ServiceRequest',
            entityId: id,
            action: 'anonymized',
            before: previous,
            after: { status: saved.status, resolutionNote: saved.resolutionNote, records: matched },
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
