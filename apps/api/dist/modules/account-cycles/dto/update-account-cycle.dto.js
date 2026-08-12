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
exports.UpdateAccountCycleDto = void 0;
const class_validator_1 = require("class-validator");
const PROCESS_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];
class UpdateAccountCycleDto {
}
exports.UpdateAccountCycleDto = UpdateAccountCycleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['planning', 'active', 'closed']),
    __metadata("design:type", String)
], UpdateAccountCycleDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(PROCESS_STATUSES),
    __metadata("design:type", String)
], UpdateAccountCycleDto.prototype, "gridStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(PROCESS_STATUSES),
    __metadata("design:type", String)
], UpdateAccountCycleDto.prototype, "productionStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(31),
    __metadata("design:type", Number)
], UpdateAccountCycleDto.prototype, "weeklyMeetingsCompleted", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(PROCESS_STATUSES),
    __metadata("design:type", String)
], UpdateAccountCycleDto.prototype, "strategyMeetingStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(PROCESS_STATUSES),
    __metadata("design:type", String)
], UpdateAccountCycleDto.prototype, "reportStatus", void 0);
