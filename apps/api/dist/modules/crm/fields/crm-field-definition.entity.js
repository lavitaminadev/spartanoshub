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
exports.CrmFieldDefinition = void 0;
const typeorm_1 = require("typeorm");
let CrmFieldDefinition = class CrmFieldDefinition {
};
exports.CrmFieldDefinition = CrmFieldDefinition;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CrmFieldDefinition.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], CrmFieldDefinition.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20 }),
    __metadata("design:type", String)
], CrmFieldDefinition.prototype, "entity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], CrmFieldDefinition.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'field_key', length: 40 }),
    __metadata("design:type", String)
], CrmFieldDefinition.prototype, "fieldKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 80 }),
    __metadata("design:type", String)
], CrmFieldDefinition.prototype, "label", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20 }),
    __metadata("design:type", String)
], CrmFieldDefinition.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], CrmFieldDefinition.prototype, "options", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], CrmFieldDefinition.prototype, "required", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CrmFieldDefinition.prototype, "position", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'meta_questions', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], CrmFieldDefinition.prototype, "metaQuestions", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'archived_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], CrmFieldDefinition.prototype, "archivedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CrmFieldDefinition.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], CrmFieldDefinition.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], CrmFieldDefinition.prototype, "updatedAt", void 0);
exports.CrmFieldDefinition = CrmFieldDefinition = __decorate([
    (0, typeorm_1.Entity)('crm_field_definitions'),
    (0, typeorm_1.Index)('UQ_crm_field_org_entity_key_client', ['organizationId', 'entity', 'fieldKey', 'clientId'], { unique: true }),
    (0, typeorm_1.Index)('IDX_crm_field_org_entity', ['organizationId', 'entity', 'archivedAt'])
], CrmFieldDefinition);
