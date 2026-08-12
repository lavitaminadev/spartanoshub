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
exports.SurveyResponse = void 0;
const typeorm_1 = require("typeorm");
let SurveyResponse = class SurveyResponse {
};
exports.SurveyResponse = SurveyResponse;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], SurveyResponse.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', length: 36 }),
    __metadata("design:type", String)
], SurveyResponse.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'survey_id', length: 36 }),
    __metadata("design:type", String)
], SurveyResponse.prototype, "surveyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'respondent_id', length: 100 }),
    __metadata("design:type", String)
], SurveyResponse.prototype, "respondentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json' }),
    __metadata("design:type", Object)
], SurveyResponse.prototype, "answers", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'submitted_at' }),
    __metadata("design:type", Date)
], SurveyResponse.prototype, "submittedAt", void 0);
exports.SurveyResponse = SurveyResponse = __decorate([
    (0, typeorm_1.Entity)('survey_responses'),
    (0, typeorm_1.Index)('IDX_survey_response_survey', ['surveyId'])
], SurveyResponse);
