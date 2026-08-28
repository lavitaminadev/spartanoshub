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
var MetaConversionOutboxService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaConversionOutboxService = void 0;
const common_1 = require("@nestjs/common");
const identificadores_meta_1 = require("./identificadores-meta");
const politica_meta_capi_1 = require("./politica-meta-capi");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const outbox_processor_base_1 = require("../../../core/outbox/outbox-processor.base");
const meta_conversions_service_1 = require("./meta-conversions.service");
const meta_conversion_outbox_entity_1 = require("./meta-conversion-outbox.entity");
const meta_client_pixel_service_1 = require("./meta-client-pixel.service");
const MAX_AGE_DAYS_BY_ACTION_SOURCE = {
    physical_store: 62,
};
const DEFAULT_MAX_AGE_DAYS = 7;
const META_OAUTH_ERROR_CODE = 190;
let MetaConversionOutboxService = MetaConversionOutboxService_1 = class MetaConversionOutboxService extends outbox_processor_base_1.OutboxProcessor {
    constructor(repository, conversions, clientPixels) {
        super();
        this.repository = repository;
        this.conversions = conversions;
        this.clientPixels = clientPixels;
        this.logger = new common_1.Logger(MetaConversionOutboxService_1.name);
        this.entity = meta_conversion_outbox_entity_1.MetaConversionOutbox;
        this.label = 'Meta CAPI';
    }
    async enqueue(organizationId, pixelId, event) {
        const eventId = event.eventId;
        if (!eventId)
            throw new Error('A stable eventId is required for Meta CAPI');
        const existing = await this.repository.findOne({ where: { organizationId, eventId } });
        if (existing)
            return existing;
        const infracciones = (0, politica_meta_capi_1.revisarEvento)(event);
        if (infracciones.length > 0) {
            (0, politica_meta_capi_1.registrarBloqueo)(eventId, infracciones);
            throw new common_1.BadRequestException(`Meta CAPI: el evento incluye campos no autorizados (${infracciones.map((i) => `${i.seccion}.${i.campo}`).join(', ')})`);
        }
        const permitido = (0, politica_meta_capi_1.construirEventoPermitido)(event);
        const evento = { ...permitido, userData: (0, identificadores_meta_1.prepararIdentificadores)(permitido.userData) };
        return this.repository.save(this.repository.create({ organizationId, pixelId, eventId, eventData: evento }));
    }
    async stats(organizationId) {
        const scope = organizationId ? { organizationId } : {};
        const countBy = (status) => this.repository.count({ where: status ? { ...scope, status } : scope });
        const [pending, retry, processing, failed, expired, processed, total] = await Promise.all([
            countBy('pending'),
            countBy('retry'),
            countBy('processing'),
            countBy('failed'),
            countBy('expired'),
            countBy('processed'),
            countBy(),
        ]);
        return { pending, retry, processing, failed, expired, processed, total };
    }
    async recentProblems(organizationId, limit = 20) {
        return this.repository.find({
            where: [
                { organizationId, status: 'failed' },
                { organizationId, status: 'expired' },
                { organizationId, status: 'retry' },
            ],
            order: { updatedAt: 'DESC' },
            take: Math.min(Math.max(limit, 1), 100),
        });
    }
    expirationReason(item) {
        const event = item.eventData;
        const eventTime = Number(event?.eventTime ?? 0);
        if (eventTime <= 0)
            return null;
        const maxAgeDays = MAX_AGE_DAYS_BY_ACTION_SOURCE[event?.actionSource ?? ''] ?? DEFAULT_MAX_AGE_DAYS;
        if (Date.now() - eventTime * 1000 <= maxAgeDays * 86_400_000)
            return null;
        return `El evento supera los ${maxAgeDays} días que acepta Meta para su origen y ya no puede atribuirse.`;
    }
    async send(item) {
        const token = await this.clientPixels.resolveByPixel(item.organizationId, item.pixelId);
        if (!token)
            throw new Error('Meta conversion token is unavailable');
        const respuesta = await this.conversions.sendServerEvent(item.pixelId, token, item.eventData);
        const recibidos = respuesta?.events_received;
        if (typeof recibidos === 'number' && recibidos < 1) {
            throw new Error(`Meta respondió sin recibir el evento (events_received: ${recibidos})`);
        }
    }
    classifyFailure(error) {
        const apiError = error;
        const statusCode = apiError?.response?.status;
        const metaError = apiError?.response?.data?.error;
        const bodyMsg = metaError?.message ?? metaError?.error_user_msg ?? '';
        const isNonRetryable = typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500 && statusCode !== 429;
        const isExpiredToken = metaError?.code === META_OAUTH_ERROR_CODE
            || /expired|invalid.*token|invalidated|revoked|unauthorized/i.test(bodyMsg);
        const prefijos = [
            isExpiredToken ? '[TOKEN]' : null,
            statusCode ? `HTTP ${statusCode}:` : null,
        ].filter(Boolean);
        return {
            retryable: !isNonRetryable && !isExpiredToken,
            tag: prefijos.length ? prefijos.join(' ') : undefined,
            detail: metaError
                ? [
                    `meta code=${metaError.code ?? '?'}`,
                    metaError.error_subcode ? `subcode=${metaError.error_subcode}` : null,
                    metaError.type ? `type=${metaError.type}` : null,
                    bodyMsg ? `msg="${bodyMsg}"` : null,
                    metaError.fbtrace_id ? `fbtrace=${metaError.fbtrace_id}` : null,
                ].filter(Boolean).join(' ')
                : undefined,
        };
    }
};
exports.MetaConversionOutboxService = MetaConversionOutboxService;
exports.MetaConversionOutboxService = MetaConversionOutboxService = MetaConversionOutboxService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(meta_conversion_outbox_entity_1.MetaConversionOutbox)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        meta_conversions_service_1.MetaConversionsService,
        meta_client_pixel_service_1.MetaClientPixelService])
], MetaConversionOutboxService);
