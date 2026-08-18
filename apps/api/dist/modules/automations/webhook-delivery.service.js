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
var WebhookDeliveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookDeliveryService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const typeorm_1 = require("@nestjs/typeorm");
const rxjs_1 = require("rxjs");
const typeorm_2 = require("typeorm");
const outbox_processor_base_1 = require("../../core/outbox/outbox-processor.base");
const webhook_delivery_entity_1 = require("./webhook-delivery.entity");
const REQUEST_TIMEOUT_MS = 10_000;
const INTERNAL_HOST_PATTERNS = [
    /^localhost$/,
    /^::1$/,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^169\.254\.169\.254$/,
];
let WebhookDeliveryService = WebhookDeliveryService_1 = class WebhookDeliveryService extends outbox_processor_base_1.OutboxProcessor {
    constructor(repository, http) {
        super();
        this.repository = repository;
        this.http = http;
        this.logger = new common_1.Logger(WebhookDeliveryService_1.name);
        this.entity = webhook_delivery_entity_1.WebhookDelivery;
        this.label = 'Webhook';
        this.maxAttempts = 6;
    }
    async enqueue(organizationId, url, payload, runId) {
        this.assertSafeUrl(url);
        return this.repository.save(this.repository.create({
            organizationId, url, payload, runId: runId ?? null, status: 'pending',
        }));
    }
    assertSafeUrl(rawUrl) {
        let url;
        try {
            url = new URL(rawUrl);
        }
        catch {
            throw new common_1.BadRequestException('La dirección del webhook no es válida');
        }
        if (url.protocol !== 'https:') {
            throw new common_1.BadRequestException('El webhook debe usar HTTPS');
        }
        const host = url.hostname.toLowerCase();
        if (INTERNAL_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
            throw new common_1.BadRequestException('El webhook no puede apuntar a una dirección interna');
        }
    }
    async send(item) {
        const response = await (0, rxjs_1.firstValueFrom)(this.http.post(item.url, item.payload, {
            timeout: REQUEST_TIMEOUT_MS,
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'Espartanos-Automations/1' },
        }));
        item.lastStatusCode = response.status;
    }
    classifyFailure(error) {
        const status = error?.response?.status;
        const definitivo = typeof status === 'number' && status >= 400 && status < 500 && status !== 429;
        return { retryable: !definitivo, tag: status ? `HTTP ${status}:` : undefined };
    }
};
exports.WebhookDeliveryService = WebhookDeliveryService;
exports.WebhookDeliveryService = WebhookDeliveryService = WebhookDeliveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(webhook_delivery_entity_1.WebhookDelivery)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        axios_1.HttpService])
], WebhookDeliveryService);
