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
var PurgeExpiredLeadsJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurgeExpiredLeadsJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const lead_entity_1 = require("../../../modules/crm/leads/lead.entity");
const data_protection_service_1 = require("../../data-protection/data-protection.service");
const RESERVATION_RETENTION_DAYS = 180;
let PurgeExpiredLeadsJob = PurgeExpiredLeadsJob_1 = class PurgeExpiredLeadsJob {
    constructor(leadRepo, dataProtection) {
        this.leadRepo = leadRepo;
        this.dataProtection = dataProtection;
        this.logger = new common_1.Logger(PurgeExpiredLeadsJob_1.name);
    }
    async handle() {
        const now = new Date();
        this.logger.log('Reviewing expired CRM leads for anonymization...');
        const expiredLeads = await this.leadRepo.find({
            where: {
                retentionReviewAt: (0, typeorm_2.LessThan)(now),
                fitStatus: 'unqualified',
            },
            order: { retentionReviewAt: 'ASC' },
            take: 200,
        });
        let anonymized = 0;
        for (const lead of expiredLeads) {
            if (lead.metadata?.retentionAnonymizedAt)
                continue;
            try {
                await this.dataProtection.anonymizeLead(lead.id, lead.organizationId, 'Retención expirada');
                anonymized += 1;
            }
            catch (error) {
                this.logger.error(`Failed to anonymize lead ${lead.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        this.logger.log(`Expired leads reviewed: ${expiredLeads.length}, anonymized: ${anonymized}`);
        const reservations = await this.dataProtection.anonymizeExpiredReservations(RESERVATION_RETENTION_DAYS);
        this.logger.log(`Expired reservations reviewed: ${reservations.reviewed}, anonymized: ${reservations.anonymized}`);
    }
};
exports.PurgeExpiredLeadsJob = PurgeExpiredLeadsJob;
exports.PurgeExpiredLeadsJob = PurgeExpiredLeadsJob = PurgeExpiredLeadsJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        data_protection_service_1.DataProtectionService])
], PurgeExpiredLeadsJob);
