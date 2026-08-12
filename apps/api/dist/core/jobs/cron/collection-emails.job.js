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
var CollectionEmailsJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionEmailsJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const invoice_entity_1 = require("../../../modules/billing/invoice.entity");
const client_entity_1 = require("../../../modules/clients/client.entity");
const email_service_1 = require("../../notifications/email.service");
let CollectionEmailsJob = CollectionEmailsJob_1 = class CollectionEmailsJob {
    constructor(invoiceRepo, clientRepo, emailService) {
        this.invoiceRepo = invoiceRepo;
        this.clientRepo = clientRepo;
        this.emailService = emailService;
        this.logger = new common_1.Logger(CollectionEmailsJob_1.name);
    }
    async handle() {
        this.logger.log('Processing overdue invoices...');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdueInvoices = await this.invoiceRepo.find({
            where: { status: 'pending', dueAt: (0, typeorm_2.LessThan)(today) },
            relations: ['client'],
        });
        let sent = 0;
        for (const invoice of overdueInvoices) {
            try {
                const client = invoice.client;
                if (!client) {
                    this.logger.warn(`Invoice ${invoice.number} has no associated client, skipping`);
                    continue;
                }
                const email = await this.resolveClientEmail(client.id);
                if (!email) {
                    this.logger.warn(`Client ${client.id} has no email, skipping invoice ${invoice.number}`);
                    continue;
                }
                const dueDateStr = invoice.dueAt instanceof Date
                    ? invoice.dueAt.toISOString().split('T')[0]
                    : String(invoice.dueAt);
                const delivered = await this.emailService.sendCollectionEmail(client.name, email, invoice.number, Number(invoice.total), dueDateStr);
                if (delivered) {
                    invoice.status = 'overdue';
                    await this.invoiceRepo.save(invoice);
                    sent++;
                    this.logger.log(`Collection email accepted for invoice ${invoice.number}`);
                }
                else {
                    this.logger.warn(`Collection email was not delivered for invoice ${invoice.number}; will retry next run`);
                }
            }
            catch (error) {
                this.logger.error(`Failed to process overdue invoice ${invoice.number}: ${error instanceof Error ? error.message : error}`);
            }
        }
        this.logger.log(`Processed ${overdueInvoices.length} overdue invoices, sent ${sent} emails`);
    }
    async resolveClientEmail(clientId) {
        const client = await this.clientRepo.findOne({
            where: { id: clientId },
            relations: ['lead'],
        });
        return client?.lead?.email ?? null;
    }
};
exports.CollectionEmailsJob = CollectionEmailsJob;
exports.CollectionEmailsJob = CollectionEmailsJob = CollectionEmailsJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(invoice_entity_1.Invoice)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        email_service_1.EmailService])
], CollectionEmailsJob);
//# sourceMappingURL=collection-emails.job.js.map