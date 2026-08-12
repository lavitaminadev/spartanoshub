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
exports.AvailabilityBlock = void 0;
const typeorm_1 = require("typeorm");
let AvailabilityBlock = class AvailabilityBlock {
};
exports.AvailabilityBlock = AvailabilityBlock;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AvailabilityBlock.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], AvailabilityBlock.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], AvailabilityBlock.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'form_id', type: 'uuid' }),
    __metadata("design:type", String)
], AvailabilityBlock.prototype, "formId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'starts_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], AvailabilityBlock.prototype, "startsAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ends_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], AvailabilityBlock.prototype, "endsAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 180, nullable: true }),
    __metadata("design:type", String)
], AvailabilityBlock.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid' }),
    __metadata("design:type", String)
], AvailabilityBlock.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AvailabilityBlock.prototype, "createdAt", void 0);
exports.AvailabilityBlock = AvailabilityBlock = __decorate([
    (0, typeorm_1.Entity)('reservation_availability_blocks'),
    (0, typeorm_1.Index)('IDX_reservation_blocks_form_range', ['formId', 'startsAt', 'endsAt'])
], AvailabilityBlock);
//# sourceMappingURL=availability-block.entity.js.map