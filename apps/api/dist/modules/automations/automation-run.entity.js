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
exports.AutomationRun = void 0;
const typeorm_1 = require("typeorm");
let AutomationRun = class AutomationRun {
};
exports.AutomationRun = AutomationRun;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AutomationRun.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], AutomationRun.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'automation_id', type: 'uuid' }),
    __metadata("design:type", String)
], AutomationRun.prototype, "automationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'automation_version', type: 'int', default: 1 }),
    __metadata("design:type", Number)
], AutomationRun.prototype, "automationVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'trigger_key', type: 'varchar', length: 190 }),
    __metadata("design:type", String)
], AutomationRun.prototype, "triggerKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'entity_type', type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], AutomationRun.prototype, "entityType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'entity_id', type: 'uuid' }),
    __metadata("design:type", String)
], AutomationRun.prototype, "entityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], AutomationRun.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], AutomationRun.prototype, "context", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'current_node_id', type: 'varchar', length: 60, nullable: true }),
    __metadata("design:type", Object)
], AutomationRun.prototype, "currentNodeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resume_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], AutomationRun.prototype, "resumeAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], AutomationRun.prototype, "attempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AutomationRun.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'started_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], AutomationRun.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'finished_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], AutomationRun.prototype, "finishedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AutomationRun.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], AutomationRun.prototype, "updatedAt", void 0);
exports.AutomationRun = AutomationRun = __decorate([
    (0, typeorm_1.Entity)('automation_runs'),
    (0, typeorm_1.Index)('UQ_automation_runs_trigger', ['organizationId', 'automationId', 'triggerKey'], { unique: true }),
    (0, typeorm_1.Index)('IDX_automation_runs_resume', ['status', 'resumeAt'])
], AutomationRun);
