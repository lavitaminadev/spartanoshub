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
exports.SurveyContactRequest = void 0;
const typeorm_1 = require("typeorm");
let SurveyContactRequest = class SurveyContactRequest {
};
exports.SurveyContactRequest = SurveyContactRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], SurveyContactRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], SurveyContactRequest.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], SurveyContactRequest.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'form_id', type: 'uuid' }),
    __metadata("design:type", String)
], SurveyContactRequest.prototype, "formId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'response_id', type: 'uuid' }),
    __metadata("design:type", String)
], SurveyContactRequest.prototype, "responseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'guest_name', type: 'varchar', length: 180, nullable: true }),
    __metadata("design:type", Object)
], SurveyContactRequest.prototype, "guestName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 190, nullable: true }),
    __metadata("design:type", Object)
], SurveyContactRequest.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], SurveyContactRequest.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], SurveyContactRequest.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'smallint', nullable: true }),
    __metadata("design:type", Object)
], SurveyContactRequest.prototype, "rating", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], SurveyContactRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], SurveyContactRequest.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resolved_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], SurveyContactRequest.prototype, "resolvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resolved_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], SurveyContactRequest.prototype, "resolvedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], SurveyContactRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], SurveyContactRequest.prototype, "updatedAt", void 0);
exports.SurveyContactRequest = SurveyContactRequest = __decorate([
    (0, typeorm_1.Entity)('survey_contact_requests'),
    (0, typeorm_1.Index)('IDX_survey_contact_requests_form', ['formId', 'createdAt']),
    (0, typeorm_1.Index)('UQ_survey_contact_requests_response', ['responseId'], { unique: true })
], SurveyContactRequest);
