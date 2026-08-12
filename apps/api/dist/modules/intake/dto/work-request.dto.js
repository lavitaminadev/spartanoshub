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
exports.ResolveWorkRequestDto = exports.ConvertSessionDto = exports.ConvertPieceDto = exports.UpdateWorkRequestDto = exports.CreateWorkRequestDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const piece_type_enum_1 = require("../../production/piece-type.enum");
const work_request_entity_1 = require("../work-request.entity");
class CreateWorkRequestDto {
}
exports.CreateWorkRequestDto = CreateWorkRequestDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateWorkRequestDto.prototype, "clientId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(work_request_entity_1.WorkRequestArea),
    __metadata("design:type", String)
], CreateWorkRequestDto.prototype, "area", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(4),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateWorkRequestDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateWorkRequestDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(work_request_entity_1.WORK_REQUEST_PRIORITIES),
    __metadata("design:type", String)
], CreateWorkRequestDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateWorkRequestDto.prototype, "neededBy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateWorkRequestDto.prototype, "creativeFields", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateWorkRequestDto.prototype, "operationalFields", void 0);
class UpdateWorkRequestDto {
}
exports.UpdateWorkRequestDto = UpdateWorkRequestDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(work_request_entity_1.WorkRequestStatus),
    __metadata("design:type", String)
], UpdateWorkRequestDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateWorkRequestDto.prototype, "assignedTo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(work_request_entity_1.WORK_REQUEST_PRIORITIES),
    __metadata("design:type", String)
], UpdateWorkRequestDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], UpdateWorkRequestDto.prototype, "rejectionReason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateWorkRequestDto.prototype, "operationalFields", void 0);
class ConvertPieceDto {
}
exports.ConvertPieceDto = ConvertPieceDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ConvertPieceDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(piece_type_enum_1.PieceType),
    __metadata("design:type", String)
], ConvertPieceDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], ConvertPieceDto.prototype, "difficultyLevel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(2),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], ConvertPieceDto.prototype, "carouselSlides", void 0);
class ConvertSessionDto {
}
exports.ConvertSessionDto = ConvertSessionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-z0-9_-]{2,50}$/i),
    __metadata("design:type", String)
], ConvertSessionDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ConvertSessionDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], ConvertSessionDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(30),
    (0, class_validator_1.IsUUID)(undefined, { each: true }),
    __metadata("design:type", Array)
], ConvertSessionDto.prototype, "assignedTeam", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ConvertSessionDto.prototype, "moodboardId", void 0);
class ResolveWorkRequestDto {
}
exports.ResolveWorkRequestDto = ResolveWorkRequestDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ConvertPieceDto),
    __metadata("design:type", Array)
], ResolveWorkRequestDto.prototype, "pieces", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ConvertSessionDto),
    __metadata("design:type", ConvertSessionDto)
], ResolveWorkRequestDto.prototype, "session", void 0);
//# sourceMappingURL=work-request.dto.js.map