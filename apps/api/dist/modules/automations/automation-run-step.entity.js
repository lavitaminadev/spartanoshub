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
exports.AutomationRunStep = void 0;
const typeorm_1 = require("typeorm");
let AutomationRunStep = class AutomationRunStep {
};
exports.AutomationRunStep = AutomationRunStep;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AutomationRunStep.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'run_id', type: 'uuid' }),
    __metadata("design:type", String)
], AutomationRunStep.prototype, "runId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'node_id', type: 'varchar', length: 60 }),
    __metadata("design:type", String)
], AutomationRunStep.prototype, "nodeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'node_type', type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], AutomationRunStep.prototype, "nodeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'node_key', type: 'varchar', length: 60 }),
    __metadata("design:type", String)
], AutomationRunStep.prototype, "nodeKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], AutomationRunStep.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], AutomationRunStep.prototype, "input", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], AutomationRunStep.prototype, "output", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AutomationRunStep.prototype, "error", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'duration_ms', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AutomationRunStep.prototype, "durationMs", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AutomationRunStep.prototype, "createdAt", void 0);
exports.AutomationRunStep = AutomationRunStep = __decorate([
    (0, typeorm_1.Entity)('automation_run_steps'),
    (0, typeorm_1.Index)('IDX_automation_run_steps_run', ['runId', 'createdAt'])
], AutomationRunStep);
