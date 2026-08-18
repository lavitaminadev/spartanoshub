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
exports.WebhookDelivery = void 0;
const typeorm_1 = require("typeorm");
let WebhookDelivery = class WebhookDelivery {
};
exports.WebhookDelivery = WebhookDelivery;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WebhookDelivery.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], WebhookDelivery.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'run_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], WebhookDelivery.prototype, "runId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500 }),
    __metadata("design:type", String)
], WebhookDelivery.prototype, "url", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json' }),
    __metadata("design:type", Object)
], WebhookDelivery.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], WebhookDelivery.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], WebhookDelivery.prototype, "attempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'next_attempt_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], WebhookDelivery.prototype, "nextAttemptAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_status_code', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], WebhookDelivery.prototype, "lastStatusCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WebhookDelivery.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sent_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], WebhookDelivery.prototype, "processedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], WebhookDelivery.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], WebhookDelivery.prototype, "updatedAt", void 0);
exports.WebhookDelivery = WebhookDelivery = __decorate([
    (0, typeorm_1.Entity)('automation_webhook_deliveries'),
    (0, typeorm_1.Index)('IDX_webhook_deliveries_pending', ['status', 'nextAttemptAt'])
], WebhookDelivery);
