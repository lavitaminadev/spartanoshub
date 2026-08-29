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
const campaign_entity_1 = require("../campaigns/campaign.entity");
const identificador_externo_1 = require("./identificador-externo");
const TOKEN_PREFIX = 'esp_in_';
const GRACIA_LLAVE_ANTERIOR_MS = 48 * 60 * 60 * 1000;
let LeadIngestService = LeadIngestService_1 = class LeadIngestService {
    constructor(sources, campaigns, intake) {
        this.sources = sources;
        this.campaigns = campaigns;
        this.intake = intake;
        this.logger = new common_1.Logger(LeadIngestService_1.name);
    }
    async issueToken(source) {
        const token = `${TOKEN_PREFIX}${(0, node_crypto_1.randomBytes)(24).toString('hex')}`;
        if (source.tokenHash) {
            source.previousTokenHash = source.tokenHash;
            source.previousTokenExpiresAt = new Date(Date.now() + GRACIA_LLAVE_ANTERIOR_MS);
        }
        source.tokenHash = this.hash(token);
        source.tokenHint = token.slice(-6);
        return { source: await this.sources.save(source), token };
    }
    async revokePreviousToken(source) {
        source.previousTokenHash = null;
        source.previousTokenExpiresAt = null;
        return this.sources.save(source);
    }
    async ingest(token, dto) {
        const source = await this.buscarPorLlave(token);
        if (!source)
            throw new common_1.UnauthorizedException('Llave de integración no válida');
        try {
            const lead = await this.intake.captureLead({
                organizationId: source.organizationId,
                clientId: source.clientId ?? undefined,
                name: dto.nombre,
                phone: dto.telefono,
                email: dto.email,
                company: dto.empresa,
                source: source.source,
                campaignName: source.campaignName ?? dto.campana,
                notes: dto.mensaje,
                sourceCreatedAt: dto.fechaOrigen ? new Date(dto.fechaOrigen) : undefined,
                externalLeadId: (0, identificador_externo_1.identificadorExterno)(source.source, dto.idExterno),
                externalFormId: dto.formId,
                externalFormName: dto.metadata?.formName ?? undefined,
                externalCampaignId: dto.campanaId,
                pageId: dto.paginaId,
                metadata: this.metadatosDeEntrada(dto),
            });
            await this.sources.update(source.id, {
                receivedCount: () => 'received_count + 1',
                lastReceivedAt: new Date(),
                lastError: null,
                lastErrorAt: null,
            }).catch((err) => this.logger.warn(`No se pudo actualizar el contador de ${source.id}: ${err}`));
            const campana = source.campaignName ?? dto.campana;
            const reconocida = campana
                ? await this.campaigns.exist({
                    where: {
                        organizationId: source.organizationId,
                        name: campana,
                        clientId: source.clientId ?? (0, typeorm_2.IsNull)(),
                    },
                })
                : false;
            return {
                leadId: lead.id,
                source: source.source,
                campaign: campana
                    ? {
                        name: campana,
                        recognized: reconocida,
                        ...(reconocida ? {} : {
                            hint: 'Esta campaña no está registrada en el CRM: el lead entra igual, pero su '
                                + 'inversión y su costo por lead no se podrán calcular. Regístrala en '
                                + 'CRM → Administración → Campañas con este mismo nombre.',
                        }),
                    }
                    : null,
            };
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
    async buscarPorLlave(token) {
        const huella = this.hash(token);
        const vigente = await this.sources.findOne({ where: { tokenHash: huella, isActive: true } });
        if (vigente)
            return vigente;
        const anterior = await this.sources.findOne({ where: { previousTokenHash: huella, isActive: true } });
        if (!anterior?.previousTokenExpiresAt)
            return null;
        if (anterior.previousTokenExpiresAt.getTime() <= Date.now())
            return null;
        this.logger.warn(`El origen ${anterior.id} recibió un lead con su llave anterior; caduca el `
            + `${anterior.previousTokenExpiresAt.toISOString()}. Actualiza la integración.`);
        return anterior;
    }
    metadatosDeEntrada(dto) {
        const atribucion = dto.fbclid || dto.fbc || dto.fbp
            ? {
                attribution: {
                    fbclid: dto.fbclid,
                    fbc: dto.fbc,
                    fbp: dto.fbp,
                    capturedAt: new Date().toISOString(),
                },
            }
            : {};
        const metadatos = {
            ...(dto.metadata ?? {}),
            ...(dto.anuncioId ? { adId: dto.anuncioId } : {}),
            ...atribucion,
        };
        return Object.keys(metadatos).length > 0 ? metadatos : undefined;
    }
};
exports.LeadIngestService = LeadIngestService;
exports.LeadIngestService = LeadIngestService = LeadIngestService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ingest_source_entity_1.LeadIngestSource)),
    __param(1, (0, typeorm_1.InjectRepository)(campaign_entity_1.Campaign)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        lead_intake_service_1.LeadIntakeService])
], LeadIngestService);
