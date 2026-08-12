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
exports.AccountCycle = void 0;
const typeorm_1 = require("typeorm");
const client_entity_1 = require("../clients/client.entity");
let AccountCycle = class AccountCycle {
};
exports.AccountCycle = AccountCycle;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AccountCycle.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], AccountCycle.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], AccountCycle.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => client_entity_1.Client, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'client_id' }),
    __metadata("design:type", client_entity_1.Client)
], AccountCycle.prototype, "client", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'smallint' }),
    __metadata("design:type", Number)
], AccountCycle.prototype, "year", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint' }),
    __metadata("design:type", Number)
], AccountCycle.prototype, "month", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, default: 'planning' }),
    __metadata("design:type", String)
], AccountCycle.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'grid_status', type: 'varchar', length: 30, default: 'pending' }),
    __metadata("design:type", String)
], AccountCycle.prototype, "gridStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'production_status', type: 'varchar', length: 30, default: 'pending' }),
    __metadata("design:type", String)
], AccountCycle.prototype, "productionStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'weekly_meetings_due', type: 'tinyint', default: 4 }),
    __metadata("design:type", Number)
], AccountCycle.prototype, "weeklyMeetingsDue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'weekly_meetings_completed', type: 'tinyint', default: 0 }),
    __metadata("design:type", Number)
], AccountCycle.prototype, "weeklyMeetingsCompleted", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'strategy_meeting_status', type: 'varchar', length: 30, default: 'pending' }),
    __metadata("design:type", String)
], AccountCycle.prototype, "strategyMeetingStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'report_status', type: 'varchar', length: 30, default: 'pending' }),
    __metadata("design:type", String)
], AccountCycle.prototype, "reportStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'started_at', type: 'date' }),
    __metadata("design:type", Date)
], AccountCycle.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ends_at', type: 'date' }),
    __metadata("design:type", Date)
], AccountCycle.prototype, "endsAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'closed_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], AccountCycle.prototype, "closedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AccountCycle.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], AccountCycle.prototype, "updatedAt", void 0);
exports.AccountCycle = AccountCycle = __decorate([
    (0, typeorm_1.Entity)('account_cycles'),
    (0, typeorm_1.Index)('UQ_account_cycles_client_period', ['clientId', 'year', 'month'], { unique: true })
], AccountCycle);
