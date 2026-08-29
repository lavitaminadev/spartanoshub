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
exports.DataProtectionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../../modules/users/user.entity");
const audit_entity_1 = require("../audit/audit.entity");
const consent_entity_1 = require("./consent.entity");
const lead_entity_1 = require("../../modules/crm/leads/lead.entity");
const contact_entity_1 = require("../../modules/crm/contacts/contact.entity");
const reservation_entity_1 = require("../../modules/reservations/domain/reservation.entity");
const service_request_entity_1 = require("../../modules/service-requests/service-request.entity");
const consent_version_entity_1 = require("./consent-version.entity");
const AVISO_PROVISIONAL = {
    title: 'Aviso de privacidad (texto provisional)',
    text: [
        'Este es un texto provisional mientras la agencia publica su aviso de privacidad definitivo.',
        '',
        'Los datos que entregas —nombre, correo, y el RUT o teléfono cuando corresponda— se usan',
        'únicamente para gestionar, responder y dar seguimiento a tu solicitud, y para dejar',
        'registro de qué se pidió, quién lo resolvió y cuándo.',
        '',
        'No se utilizan para otros fines ni se comparten con terceros, salvo obligación legal.',
        '',
        'Puedes ejercer tus derechos de acceso, rectificación, anonimización, portabilidad y baja',
        'por este mismo canal, conforme a la Ley 19.628 y a la Ley 21.719 que la actualiza.',
    ].join('\n'),
};
let DataProtectionService = class DataProtectionService {
    constructor(userRepo, leadRepo, auditRepo, consentRepo, contactRepo, reservationRepo, serviceRequestRepo, consentVersionRepo) {
        this.userRepo = userRepo;
        this.leadRepo = leadRepo;
        this.auditRepo = auditRepo;
        this.consentRepo = consentRepo;
        this.contactRepo = contactRepo;
        this.reservationRepo = reservationRepo;
        this.serviceRequestRepo = serviceRequestRepo;
        this.consentVersionRepo = consentVersionRepo;
    }
    async avisoPrivacidadVigente(organizationId) {
        const publicada = await this.consentVersionRepo.findOne({
            where: { organizationId, active: true },
            order: { version: 'DESC' },
        });
        if (publicada) {
            return {
                versionId: publicada.id,
                version: publicada.version,
                title: publicada.title,
                text: publicada.text,
                provisional: false,
            };
        }
        return { versionId: null, version: 0, ...AVISO_PROVISIONAL, provisional: true };
    }
    async recordAnonymization(organizationId, entityType, entityId, reason) {
        await this.auditRepo.save(this.auditRepo.create({
            organizationId,
            action: 'anonymize',
            entityType,
            entityId,
            reason,
            occurredAt: new Date(),
        }));
    }
    async anonymizeUser(userId) {
        const user = await this.userRepo.findOneBy({ id: userId });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        await this.userRepo.update(userId, {
            name: 'Usuario Anónimo',
            email: `anon-${userId}@espartanos.local`,
            phone: null,
            avatarUrl: null,
            refreshToken: null,
            isActive: false,
        });
        await this.auditRepo.update({ actorId: userId }, { actorId: null });
        await this.recordAnonymization(user.organizationId, 'User', userId, 'Solicitud de anonimización');
    }
    async exportUserData(userId) {
        const user = await this.userRepo.findOneBy({ id: userId });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const consents = await this.consentRepo.findBy({ userId });
        const auditLogs = await this.auditRepo.findBy({ actorId: userId, organizationId: user.organizationId });
        return {
            user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, avatarUrl: user.avatarUrl, createdAt: user.createdAt },
            consents: consents.map(c => ({ action: c.action, granted: c.granted, createdAt: c.createdAt })),
            auditLogs: auditLogs.map(a => ({ action: a.action, entityType: a.entityType, entityId: a.entityId, occurredAt: a.occurredAt })),
        };
    }
    async deleteUserData(userId) {
        const user = await this.userRepo.findOneBy({ id: userId });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        await this.anonymizeUser(userId);
        await this.consentRepo.delete({ userId });
    }
    async exportLeadData(leadId, organizationId) {
        const lead = await this.leadRepo.findOneBy({ id: leadId, organizationId });
        if (!lead)
            throw new common_1.NotFoundException('Lead not found');
        const auditLogs = await this.auditRepo.findBy({ organizationId, entityType: 'Lead', entityId: leadId });
        return {
            lead,
            auditLogs: auditLogs.map((log) => ({
                action: log.action,
                occurredAt: log.occurredAt,
                reason: log.reason,
            })),
        };
    }
    async anonymizeLead(leadId, organizationId, reason = 'Retención expirada') {
        const lead = await this.leadRepo.findOneBy({ id: leadId, organizationId });
        if (!lead)
            throw new common_1.NotFoundException('Lead not found');
        const anonymizedName = `Lead anonimizado ${lead.id.slice(0, 8)}`;
        lead.name = anonymizedName;
        lead.email = null;
        lead.phone = null;
        lead.company = null;
        lead.sourceDetail = null;
        lead.campaignName = null;
        lead.notes = reason;
        lead.discardReason = reason;
        lead.metadata = {
            ...(lead.metadata ?? {}),
            retentionAnonymizedAt: new Date().toISOString(),
            retentionReason: reason,
            previousFitStatus: lead.fitStatus,
        };
        const saved = await this.leadRepo.save(lead);
        await this.recordAnonymization(organizationId, 'Lead', leadId, reason);
        return saved;
    }
    async anonymizeContact(contactId, organizationId, reason = 'Retención expirada') {
        const contact = await this.contactRepo.findOneBy({ id: contactId, organizationId });
        if (!contact)
            throw new common_1.NotFoundException('Contact not found');
        contact.name = `Contacto anonimizado ${contact.id.slice(0, 8)}`;
        contact.email = null;
        contact.phone = null;
        const saved = await this.contactRepo.save(contact);
        await this.recordAnonymization(organizationId, 'Contact', contactId, reason);
        return saved;
    }
    async anonymizeReservation(reservationId, organizationId, reason = 'Retención expirada') {
        const reservation = await this.reservationRepo.findOneBy({ id: reservationId, organizationId });
        if (!reservation)
            throw new common_1.NotFoundException('Reservation not found');
        reservation.guestName = `Visitante anonimizado ${reservation.id.slice(0, 8)}`;
        reservation.guestEmail = null;
        reservation.guestPhone = null;
        reservation.answers = {};
        reservation.internalNotes = null;
        reservation.fbc = null;
        reservation.fbp = null;
        reservation.clientIpAddress = null;
        reservation.clientUserAgent = null;
        const saved = await this.reservationRepo.save(reservation);
        await this.recordAnonymization(organizationId, 'Reservation', reservationId, reason);
        return saved;
    }
    async anonymizeExpiredReservations(retentionDays, reason = 'Retención expirada') {
        const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
        const expired = await this.reservationRepo.find({ where: { startsAt: (0, typeorm_2.LessThan)(cutoff) } });
        let anonymized = 0;
        for (const reservation of expired) {
            if (reservation.guestEmail === null && reservation.guestPhone === null && reservation.guestName.startsWith('Visitante anonimizado'))
                continue;
            try {
                await this.anonymizeReservation(reservation.id, reservation.organizationId, reason);
                anonymized += 1;
            }
            catch {
            }
        }
        return { reviewed: expired.length, anonymized };
    }
    async recordConsent(userId, action, granted, ipAddress) {
        const consent = this.consentRepo.create({ userId, action, granted, ipAddress });
        return this.consentRepo.save(consent);
    }
    async anonymizeServiceRequest(requestId, organizationId, reason = 'Retención expirada') {
        const solicitud = await this.serviceRequestRepo.findOneBy({ id: requestId, organizationId });
        if (!solicitud)
            throw new common_1.NotFoundException('Service request not found');
        solicitud.requesterName = `Solicitante anonimizado ${solicitud.id.slice(0, 8)}`;
        solicitud.requesterEmail = '';
        solicitud.requesterRut = null;
        solicitud.requesterPhone = null;
        solicitud.message = null;
        solicitud.extra = null;
        solicitud.resolutionNote = null;
        const guardada = await this.serviceRequestRepo.save(solicitud);
        await this.recordAnonymization(organizationId, 'ServiceRequest', requestId, reason);
        return guardada;
    }
};
exports.DataProtectionService = DataProtectionService;
exports.DataProtectionService = DataProtectionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __param(2, (0, typeorm_1.InjectRepository)(audit_entity_1.AuditLog)),
    __param(3, (0, typeorm_1.InjectRepository)(consent_entity_1.DataConsent)),
    __param(4, (0, typeorm_1.InjectRepository)(contact_entity_1.Contact)),
    __param(5, (0, typeorm_1.InjectRepository)(reservation_entity_1.Reservation)),
    __param(6, (0, typeorm_1.InjectRepository)(service_request_entity_1.ServiceRequest)),
    __param(7, (0, typeorm_1.InjectRepository)(consent_version_entity_1.ConsentVersion)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], DataProtectionService);
