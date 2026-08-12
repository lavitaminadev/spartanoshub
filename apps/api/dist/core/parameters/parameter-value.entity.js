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
exports.ParameterValue = void 0;
const typeorm_1 = require("typeorm");
const parameter_definition_entity_1 = require("./parameter-definition.entity");
let ParameterValue = class ParameterValue {
};
exports.ParameterValue = ParameterValue;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ParameterValue.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'definition_id', type: 'uuid' }),
    __metadata("design:type", String)
], ParameterValue.prototype, "definitionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => parameter_definition_entity_1.ParameterDefinition, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'definition_id' }),
    __metadata("design:type", parameter_definition_entity_1.ParameterDefinition)
], ParameterValue.prototype, "definition", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scope_type', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], ParameterValue.prototype, "scopeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scope_id', type: 'uuid' }),
    __metadata("design:type", String)
], ParameterValue.prototype, "scopeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'value_json', type: 'json' }),
    __metadata("design:type", Object)
], ParameterValue.prototype, "valueJson", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], ParameterValue.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'valid_from', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], ParameterValue.prototype, "validFrom", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'valid_to', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], ParameterValue.prototype, "validTo", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ParameterValue.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ParameterValue.prototype, "updatedAt", void 0);
exports.ParameterValue = ParameterValue = __decorate([
    (0, typeorm_1.Entity)('parameter_values')
], ParameterValue);
