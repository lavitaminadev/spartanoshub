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
exports.SubmitSurveyResponseDto = exports.UpdateSurveyDto = exports.CreateSurveyDto = exports.SurveyQuestionDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const QUESTION_TYPES = ['nps', 'rating', 'text', 'multiple-choice'];
const SURVEY_TYPES = ['internal', 'customer'];
const SURVEY_STATUSES = ['draft', 'active', 'closed'];
const CHANNELS = ['email', 'qr', 'link'];
class SurveyQuestionDto {
}
exports.SurveyQuestionDto = SurveyQuestionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SurveyQuestionDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsIn)(QUESTION_TYPES),
    __metadata("design:type", String)
], SurveyQuestionDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], SurveyQuestionDto.prototype, "question", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SurveyQuestionDto.prototype, "required", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.ArrayMaxSize)(30),
    __metadata("design:type", Array)
], SurveyQuestionDto.prototype, "options", void 0);
class CreateSurveyDto {
}
exports.CreateSurveyDto = CreateSurveyDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateSurveyDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsIn)(SURVEY_TYPES),
    __metadata("design:type", String)
], CreateSurveyDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateSurveyDto.prototype, "clientId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SurveyQuestionDto),
    (0, class_validator_1.ArrayMaxSize)(50),
    __metadata("design:type", Array)
], CreateSurveyDto.prototype, "questions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.ArrayMaxSize)(2000),
    __metadata("design:type", Array)
], CreateSurveyDto.prototype, "recipients", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsIn)(CHANNELS, { each: true }),
    __metadata("design:type", Array)
], CreateSurveyDto.prototype, "distribution", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^(G-[A-Z0-9]{4,20})?$/i, { message: 'El ID de medición GA4 debe tener el formato G-XXXXXXXXXX' }),
    __metadata("design:type", String)
], CreateSurveyDto.prototype, "ga4MeasurementId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateSurveyDto.prototype, "designConfig", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateSurveyDto.prototype, "googleReview", void 0);
class UpdateSurveyDto {
}
exports.UpdateSurveyDto = UpdateSurveyDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateSurveyDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(SURVEY_TYPES),
    __metadata("design:type", String)
], UpdateSurveyDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateSurveyDto.prototype, "clientId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SurveyQuestionDto),
    (0, class_validator_1.ArrayMaxSize)(50),
    __metadata("design:type", Array)
], UpdateSurveyDto.prototype, "questions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(SURVEY_STATUSES),
    __metadata("design:type", String)
], UpdateSurveyDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.ArrayMaxSize)(2000),
    __metadata("design:type", Array)
], UpdateSurveyDto.prototype, "recipients", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsIn)(CHANNELS, { each: true }),
    __metadata("design:type", Array)
], UpdateSurveyDto.prototype, "distribution", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^(G-[A-Z0-9]{4,20})?$/i, { message: 'El ID de medición GA4 debe tener el formato G-XXXXXXXXXX' }),
    __metadata("design:type", String)
], UpdateSurveyDto.prototype, "ga4MeasurementId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateSurveyDto.prototype, "designConfig", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateSurveyDto.prototype, "googleReview", void 0);
class SubmitSurveyResponseDto {
}
exports.SubmitSurveyResponseDto = SubmitSurveyResponseDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SubmitSurveyResponseDto.prototype, "respondentId", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SubmitSurveyResponseDto.prototype, "answers", void 0);
