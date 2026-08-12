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
exports.IntegrationMetric = void 0;
const typeorm_1 = require("typeorm");
let IntegrationMetric = class IntegrationMetric {
};
exports.IntegrationMetric = IntegrationMetric;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], IntegrationMetric.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], IntegrationMetric.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], IntegrationMetric.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], IntegrationMetric.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_account_id', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], IntegrationMetric.prototype, "externalAccountId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'metric_date', type: 'date' }),
    __metadata("design:type", Date)
], IntegrationMetric.prototype, "metricDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], IntegrationMetric.prototype, "spend", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', default: 0 }),
    __metadata("design:type", Number)
], IntegrationMetric.prototype, "impressions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', default: 0 }),
    __metadata("design:type", Number)
], IntegrationMetric.prototype, "reach", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', default: 0 }),
    __metadata("design:type", Number)
], IntegrationMetric.prototype, "clicks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], IntegrationMetric.prototype, "conversions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], IntegrationMetric.prototype, "leads", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], IntegrationMetric.prototype, "breakdown", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], IntegrationMetric.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], IntegrationMetric.prototype, "updatedAt", void 0);
exports.IntegrationMetric = IntegrationMetric = __decorate([
    (0, typeorm_1.Entity)('integration_metrics'),
    (0, typeorm_1.Index)('UQ_integration_metric_daily', ['provider', 'externalAccountId', 'clientId', 'metricDate'], { unique: true })
], IntegrationMetric);
