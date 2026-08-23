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
exports.Survey = void 0;
const typeorm_1 = require("typeorm");
let Survey = class Survey {
};
exports.Survey = Survey;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Survey.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', length: 36 }),
    __metadata("design:type", String)
], Survey.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], Survey.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 200 }),
    __metadata("design:type", String)
], Survey.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20 }),
    __metadata("design:type", String)
], Survey.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json' }),
    __metadata("design:type", Array)
], Survey.prototype, "questions", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20, default: 'draft' }),
    __metadata("design:type", String)
], Survey.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', length: 36 }),
    __metadata("design:type", String)
], Survey.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], Survey.prototype, "recipients", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], Survey.prototype, "distribution", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ga4_measurement_id', type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], Survey.prototype, "ga4MeasurementId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'response_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Survey.prototype, "responseCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'design_config', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], Survey.prototype, "designConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'google_review', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], Survey.prototype, "googleReview", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Survey.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Survey.prototype, "updatedAt", void 0);
exports.Survey = Survey = __decorate([
    (0, typeorm_1.Entity)('surveys'),
    (0, typeorm_1.Index)('IDX_survey_org_status', ['organizationId', 'status']),
    (0, typeorm_1.Index)('IDX_survey_org_client', ['organizationId', 'clientId'])
], Survey);
