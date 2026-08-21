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
var LeadIngestService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadIngestService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const node_crypto_1 = require("node:crypto");
const ingest_source_entity_1 = require("./ingest-source.entity");
const lead_intake_service_1 = require("./lead-intake.service");
const identificador_externo_1 = require("./identificador-externo");
const TOKEN_PREFIX = 'esp_in_';
let LeadIngestService = LeadIngestService_1 = class LeadIngestService {
    constructor(sources, intake) {
        this.sources = sources;
        this.intake = intake;
        this.logger = new common_1.Logger(LeadIngestService_1.name);
    }
    async issueToken(source) {
        const token = `${TOKEN_PREFIX}${(0, node_crypto_1.randomBytes)(24).toString('hex')}`;
        source.tokenHash = this.hash(token);
        source.tokenHint = token.slice(-6);
        return { source: await this.sources.save(source), token };
    }
    async ingest(token, dto) {
        const source = await this.sources.findOne({ where: { tokenHash: this.hash(token), isActive: true } });
        if (!source)
            throw new common_1.UnauthorizedException('Llave de integración no válida');
        try {
            const lead = await this.intake.captureLead({
                organizationId: source.organizationId,
                clientId: source.clientId ?? undefined,
                name: dto.nombre,
                phone: dto.telefono,
                email: dto.email,
                source: source.source,
                campaignName: source.campaignName ?? dto.campana,
                notes: dto.mensaje,
                sourceCreatedAt: dto.fechaOrigen ? new Date(dto.fechaOrigen) : undefined,
                externalLeadId: (0, identificador_externo_1.identificadorExterno)(source.source, dto.idExterno),
                externalFormId: dto.formId,
                externalCampaignId: dto.campanaId,
                pageId: dto.paginaId,
                metadata: dto.anuncioId ? { adId: dto.anuncioId } : undefined,
            });
            await this.sources.update(source.id, {
                receivedCount: () => 'received_count + 1',
                lastReceivedAt: new Date(),
                lastError: null,
                lastErrorAt: null,
            }).catch((err) => this.logger.warn(`No se pudo actualizar el contador de ${source.id}: ${err}`));
            return { leadId: lead.id, source: source.source };
        }
        catch (err) {
            const motivo = err instanceof Error ? err.message : String(err);
            await this.sources.update(source.id, { lastError: motivo.slice(0, 300), lastErrorAt: new Date() })
                .catch(() => undefined);
            throw err;
        }
    }
    hash(token) {
        return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
    }
};
exports.LeadIngestService = LeadIngestService;
exports.LeadIngestService = LeadIngestService = LeadIngestService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ingest_source_entity_1.LeadIngestSource)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        lead_intake_service_1.LeadIntakeService])
], LeadIngestService);
