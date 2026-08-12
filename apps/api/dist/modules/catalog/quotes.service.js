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
exports.QuotesService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const client_entity_1 = require("../clients/client.entity");
const client_status_enum_1 = require("../clients/client-status.enum");
const contract_entity_1 = require("../contracts/contract.entity");
const lead_entity_1 = require("../crm/leads/lead.entity");
const lead_status_enum_1 = require("../crm/leads/lead-status.enum");
const quote_entity_1 = require("./quote.entity");
const quote_status_enum_1 = require("./quote-status.enum");
const service_entity_1 = require("./service.entity");
let QuotesService = class QuotesService {
    constructor(quotes, clients, leads, services, contracts, events) {
        this.quotes = quotes;
        this.clients = clients;
        this.leads = leads;
        this.services = services;
        this.contracts = contracts;
        this.events = events;
    }
    list(organizationId) { return this.quotes.find({ where: { organizationId }, relations: ['client', 'lead'], order: { createdAt: 'DESC' }, take: 300 }); }
    async create(organizationId, userId, dto) {
        await this.validateTarget(organizationId, dto.clientId, dto.leadId);
        const items = await this.normalizeItems(organizationId, dto.items);
        return this.quotes.save(this.quotes.create({
            organizationId, createdBy: userId, clientId: dto.clientId, leadId: dto.leadId,
            number: `COT-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
            title: dto.title.trim(), currency: dto.currency ?? 'CLP', validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
            notes: dto.notes?.trim() || undefined, items, amount: this.total(items), status: quote_status_enum_1.QuoteStatus.DRAFT, version: 1,
        }));
    }
    async update(id, organizationId, dto) {
        const quote = await this.find(id, organizationId);
        if (quote.status !== quote_status_enum_1.QuoteStatus.DRAFT)
            throw new common_1.BadRequestException('Solo se puede editar una cotización en borrador');
        await this.validateTarget(organizationId, dto.clientId, dto.leadId);
        const items = await this.normalizeItems(organizationId, dto.items);
        Object.assign(quote, { clientId: dto.clientId, leadId: dto.leadId, title: dto.title.trim(), currency: dto.currency ?? quote.currency, validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined, notes: dto.notes?.trim() || undefined, items, amount: this.total(items) });
        return this.quotes.save(quote);
    }
    async createVersion(id, organizationId, userId) {
        const source = await this.find(id, organizationId);
        const rootId = source.parentQuoteId ?? source.id;
        const latest = await this.quotes.find({ where: [{ id: rootId, organizationId }, { parentQuoteId: rootId, organizationId }], order: { version: 'DESC' }, take: 1 });
        return this.quotes.save(this.quotes.create({ ...source, id: undefined, createdAt: undefined, updatedAt: undefined, number: `COT-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`, status: quote_status_enum_1.QuoteStatus.DRAFT, acceptedAt: undefined, sentAt: undefined, parentQuoteId: rootId, version: Number(latest[0]?.version ?? source.version ?? 1) + 1, createdBy: userId }));
    }
    async send(id, organizationId) {
        const quote = await this.find(id, organizationId);
        if (quote.status !== quote_status_enum_1.QuoteStatus.DRAFT)
            throw new common_1.BadRequestException('La cotización ya fue enviada o cerrada');
        quote.status = quote_status_enum_1.QuoteStatus.SENT;
        quote.sentAt = new Date();
        if (quote.leadId)
            await this.leads.update({ id: quote.leadId, organizationId }, { status: lead_status_enum_1.LeadStatus.QUOTE_SENT });
        return this.quotes.save(quote);
    }
    async accept(id, organizationId, _userId) {
        const quote = await this.find(id, organizationId);
        if (![quote_status_enum_1.QuoteStatus.DRAFT, quote_status_enum_1.QuoteStatus.SENT].includes(quote.status))
            throw new common_1.BadRequestException('La cotización no se puede aceptar en su estado actual');
        const result = await this.quotes.manager.transaction(async (manager) => {
            let client = quote.clientId ? await manager.findOne(client_entity_1.Client, { where: { id: quote.clientId, organizationId } }) : null;
            if (!client && quote.leadId) {
                const lead = await manager.findOne(lead_entity_1.Lead, { where: { id: quote.leadId, organizationId } });
                if (!lead)
                    throw new common_1.NotFoundException('Lead no encontrado');
                client = await manager.save(client_entity_1.Client, manager.create(client_entity_1.Client, { organizationId, leadId: lead.id, name: lead.name, status: client_status_enum_1.ClientStatus.ONBOARDING, retainerAmount: quote.amount }));
                lead.status = lead_status_enum_1.LeadStatus.WON;
                lead.convertedAt = new Date();
                lead.convertedToClientId = client.id;
                await manager.save(lead_entity_1.Lead, lead);
                quote.clientId = client.id;
            }
            if (!client)
                throw new common_1.BadRequestException('La cotización debe estar asociada a un lead o cliente');
            quote.status = quote_status_enum_1.QuoteStatus.ACCEPTED;
            quote.acceptedAt = new Date();
            await manager.save(quote_entity_1.Quote, quote);
            const serviceIds = (quote.items ?? []).map((item) => item.serviceId).filter((value) => typeof value === 'string');
            const serviceRows = serviceIds.length ? await manager.find(service_entity_1.Service, { where: serviceIds.map((serviceId) => ({ id: serviceId, organizationId })) }) : [];
            const monthlyUd = (quote.items ?? []).reduce((sum, item) => sum + Number(serviceRows.find((service) => service.id === item.serviceId)?.udPerUnit ?? 0) * Number(item.quantity ?? 1), 0);
            const contract = await manager.save(contract_entity_1.Contract, manager.create(contract_entity_1.Contract, { organizationId, clientId: client.id, name: quote.title, serviceType: (quote.items ?? []).map((item) => item.description).join(', ').slice(0, 255), startDate: new Date(), monthlyUd, monthlyPrice: quote.amount, status: 'active', terms: quote.notes }));
            client.retainerAmount = quote.amount;
            if (monthlyUd > 0)
                client.defaultUdBudget = monthlyUd;
            await manager.save(client_entity_1.Client, client);
            return { quote, client, contract };
        });
        if (quote.leadId)
            this.events.emit('lead.converted', { organizationId, leadId: quote.leadId, clientId: result.client.id });
        return result;
    }
    async find(id, organizationId) {
        const quote = await this.quotes.findOne({ where: { id, organizationId }, relations: ['client', 'lead'] });
        if (!quote)
            throw new common_1.NotFoundException('Cotización no encontrada');
        return quote;
    }
    async validateTarget(organizationId, clientId, leadId) {
        if ((!clientId && !leadId) || (clientId && leadId))
            throw new common_1.BadRequestException('Selecciona un lead o un cliente');
        if (clientId && !await this.clients.findOne({ where: { id: clientId, organizationId } }))
            throw new common_1.BadRequestException('El cliente no pertenece a la organización');
        if (leadId && !await this.leads.findOne({ where: { id: leadId, organizationId } }))
            throw new common_1.BadRequestException('El lead no pertenece a la organización');
    }
    async normalizeItems(organizationId, items) {
        if (!items.length)
            throw new common_1.BadRequestException('Agrega al menos un ítem a la cotización');
        const serviceIds = items.map((item) => item.serviceId).filter((value) => Boolean(value));
        if (serviceIds.length && await this.services.count({ where: serviceIds.map((id) => ({ id, organizationId })) }) !== new Set(serviceIds).size)
            throw new common_1.BadRequestException('Uno de los servicios no pertenece al catálogo');
        return items.map((item) => ({ serviceId: item.serviceId, description: item.description.trim(), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), total: Number(item.quantity) * Number(item.unitPrice) }));
    }
    total(items) { return items.reduce((sum, item) => sum + Number(item.total ?? 0), 0); }
};
exports.QuotesService = QuotesService;
exports.QuotesService = QuotesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(quote_entity_1.Quote)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(2, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __param(3, (0, typeorm_1.InjectRepository)(service_entity_1.Service)),
    __param(4, (0, typeorm_1.InjectRepository)(contract_entity_1.Contract)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], QuotesService);
