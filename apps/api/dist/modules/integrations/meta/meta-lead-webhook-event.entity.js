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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaLeadWebhookEvent = void 0;
const typeorm_1 = require("typeorm");
let MetaLeadWebhookEvent = class MetaLeadWebhookEvent {
};
exports.MetaLeadWebhookEvent = MetaLeadWebhookEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MetaLeadWebhookEvent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], MetaLeadWebhookEvent.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'page_id', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], MetaLeadWebhookEvent.prototype, "pageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'leadgen_id', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], MetaLeadWebhookEvent.prototype, "leadgenId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'form_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], MetaLeadWebhookEvent.prototype, "formId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'processing_status', type: 'varchar', length: 50, default: 'received' }),
    __metadata("design:type", String)
], MetaLeadWebhookEvent.prototype, "processingStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', type: 'text', nullable: true }),
    __metadata("design:type", String)
], MetaLeadWebhookEvent.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'raw_payload', type: 'json' }),
    __metadata("design:type", Object)
], MetaLeadWebhookEvent.prototype, "rawPayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'normalized_payload', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], MetaLeadWebhookEvent.prototype, "normalizedPayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'processed_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], MetaLeadWebhookEvent.prototype, "processedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], MetaLeadWebhookEvent.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], MetaLeadWebhookEvent.prototype, "updatedAt", void 0);
exports.MetaLeadWebhookEvent = MetaLeadWebhookEvent = __decorate([
    (0, typeorm_1.Entity)('meta_lead_webhook_events'),
    (0, typeorm_1.Index)('UQ_meta_lead_webhook_page_lead', ['pageId', 'leadgenId'], { unique: true })
], MetaLeadWebhookEvent);
//# sourceMappingURL=meta-lead-webhook-event.entity.js.map