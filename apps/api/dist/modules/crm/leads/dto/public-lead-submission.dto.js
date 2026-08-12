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
exports.PublicLeadSubmissionDto = exports.PublicLeadTrackingDto = exports.PublicLeadConsentDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class PublicLeadConsentDto {
}
exports.PublicLeadConsentDto = PublicLeadConsentDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PublicLeadConsentDto.prototype, "privacyAccepted", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PublicLeadConsentDto.prototype, "marketingAccepted", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], PublicLeadConsentDto.prototype, "policyVersion", void 0);
class PublicLeadTrackingDto {
}
exports.PublicLeadTrackingDto = PublicLeadTrackingDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], PublicLeadTrackingDto.prototype, "utmSource", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], PublicLeadTrackingDto.prototype, "utmMedium", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(180),
    __metadata("design:type", String)
], PublicLeadTrackingDto.prototype, "utmCampaign", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(180),
    __metadata("design:type", String)
], PublicLeadTrackingDto.prototype, "utmContent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], PublicLeadTrackingDto.prototype, "utmTerm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], PublicLeadTrackingDto.prototype, "fbclid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], PublicLeadTrackingDto.prototype, "gclid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], PublicLeadTrackingDto.prototype, "landingUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], PublicLeadTrackingDto.prototype, "referrer", void 0);
class PublicLeadSubmissionDto {
}
exports.PublicLeadSubmissionDto = PublicLeadSubmissionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(180),
    __metadata("design:type", String)
], PublicLeadSubmissionDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], PublicLeadSubmissionDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^[\d+\-\s()]+$/, { message: 'Invalid phone format' }),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], PublicLeadSubmissionDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], PublicLeadSubmissionDto.prototype, "company", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({ require_protocol: true }),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], PublicLeadSubmissionDto.prototype, "website", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], PublicLeadSubmissionDto.prototype, "jobTitle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], PublicLeadSubmissionDto.prototype, "serviceInterest", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], PublicLeadSubmissionDto.prototype, "budgetRange", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], PublicLeadSubmissionDto.prototype, "message", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PublicLeadConsentDto),
    __metadata("design:type", PublicLeadConsentDto)
], PublicLeadSubmissionDto.prototype, "consent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PublicLeadTrackingDto),
    __metadata("design:type", PublicLeadTrackingDto)
], PublicLeadSubmissionDto.prototype, "tracking", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], PublicLeadSubmissionDto.prototype, "company_website_confirm", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(16),
    (0, class_validator_1.MaxLength)(80),
    (0, class_validator_1.Matches)(/^[A-Za-z0-9_-]{16,80}$/, { message: 'idempotencyKey debe ser un identificador aleatorio de 16 a 80 caracteres (A-Z, a-z, 0-9, guion o guion bajo)' }),
    __metadata("design:type", String)
], PublicLeadSubmissionDto.prototype, "idempotencyKey", void 0);
