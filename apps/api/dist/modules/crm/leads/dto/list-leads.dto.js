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
exports.ListLeadsQueryDto = void 0;
const class_validator_1 = require("class-validator");
const pagination_dto_1 = require("../../../../shared/dto/pagination.dto");
const lead_status_enum_1 = require("../lead-status.enum");
const lead_fit_status_enum_1 = require("../lead-fit-status.enum");
class ListLeadsQueryDto extends pagination_dto_1.PaginationDto {
}
exports.ListLeadsQueryDto = ListLeadsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(lead_status_enum_1.LeadStatus),
    __metadata("design:type", String)
], ListLeadsQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(lead_fit_status_enum_1.LeadFitStatus),
    __metadata("design:type", String)
], ListLeadsQueryDto.prototype, "fitStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListLeadsQueryDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ListLeadsQueryDto.prototype, "clientId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['audience', 'commercial', 'all']),
    __metadata("design:type", String)
], ListLeadsQueryDto.prototype, "domain", void 0);
//# sourceMappingURL=list-leads.dto.js.map