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
exports.PublicAgencyLeadsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const crypto_1 = require("crypto");
const public_decorator_1 = require("../../../core/auth/decorators/public.decorator");
const lead_intake_service_1 = require("./lead-intake.service");
const public_lead_submission_dto_1 = require("./dto/public-lead-submission.dto");
let PublicAgencyLeadsController = class PublicAgencyLeadsController {
    constructor(leadIntake) {
        this.leadIntake = leadIntake;
    }
    agencyOrganizationId() {
        const id = process.env.AGENCY_ORGANIZATION_ID;
        if (!id)
            throw new common_1.ForbiddenException('El formulario de contacto no está disponible por ahora');
        return id;
    }
    async submit(dto) {
        if (dto.company_website_confirm) {
            return { success: true, submissionId: (0, crypto_1.randomUUID)(), message: 'Información recibida correctamente' };
        }
        if (!dto.consent.privacyAccepted) {
            throw new common_1.BadRequestException('Debes aceptar el aviso de privacidad para continuar');
        }
        if (!dto.email && !dto.phone) {
            throw new common_1.BadRequestException('Se requiere al menos un correo o un teléfono de contacto');
        }
        const organizationId = this.agencyOrganizationId();
        const messageParts = [dto.message, dto.serviceInterest ? `Interés: ${dto.serviceInterest}` : undefined, dto.budgetRange ? `Presupuesto: ${dto.budgetRange}` : undefined]
            .filter(Boolean);
        await this.leadIntake.captureLead({
            organizationId,
            domain: 'commercial',
            name: dto.name,
            email: dto.email,
            phone: dto.phone,
            company: dto.company,
            source: dto.tracking?.utmSource || 'website',
            sourceDetail: dto.tracking?.utmMedium,
            campaignName: dto.tracking?.utmCampaign,
            notes: messageParts.length > 0 ? messageParts.join(' | ') : undefined,
            externalLeadId: `public-form:${dto.idempotencyKey}`,
            consentCapturedAt: dto.consent.privacyAccepted ? new Date() : undefined,
            metadata: {
                website: dto.website,
                jobTitle: dto.jobTitle,
                tracking: dto.tracking ? { ...dto.tracking } : undefined,
                consent: { marketingAccepted: Boolean(dto.consent.marketingAccepted), policyVersion: dto.consent.policyVersion },
            },
        }, 'create-only');
        return { success: true, submissionId: (0, crypto_1.randomUUID)(), message: 'Información recibida correctamente' };
    }
};
exports.PublicAgencyLeadsController = PublicAgencyLeadsController;
__decorate([
    (0, common_1.Post)('submissions'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [public_lead_submission_dto_1.PublicLeadSubmissionDto]),
    __metadata("design:returntype", Promise)
], PublicAgencyLeadsController.prototype, "submit", null);
exports.PublicAgencyLeadsController = PublicAgencyLeadsController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiTags)('CRM Agencia (público)'),
    (0, common_1.Controller)('public/agency-crm/leads'),
    __metadata("design:paramtypes", [lead_intake_service_1.LeadIntakeService])
], PublicAgencyLeadsController);
