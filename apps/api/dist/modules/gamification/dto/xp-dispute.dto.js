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
exports.ResolveXpDisputeDto = exports.CreateXpDisputeDto = void 0;
const class_validator_1 = require("class-validator");
class CreateXpDisputeDto {
}
exports.CreateXpDisputeDto = CreateXpDisputeDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateXpDisputeDto.prototype, "xpPeriodId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10),
    (0, class_validator_1.MaxLength)(3000),
    __metadata("design:type", String)
], CreateXpDisputeDto.prototype, "message", void 0);
class ResolveXpDisputeDto {
}
exports.ResolveXpDisputeDto = ResolveXpDisputeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['accepted', 'rejected']),
    __metadata("design:type", String)
], ResolveXpDisputeDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(3000),
    __metadata("design:type", String)
], ResolveXpDisputeDto.prototype, "resolution", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(-500),
    (0, class_validator_1.Max)(500),
    __metadata("design:type", Number)
], ResolveXpDisputeDto.prototype, "adjustmentPoints", void 0);
