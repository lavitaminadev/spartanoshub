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
exports.ActionItem = void 0;
const typeorm_1 = require("typeorm");
const meeting_entity_1 = require("./meeting.entity");
const user_entity_1 = require("../users/user.entity");
const action_item_status_enum_1 = require("./action-item-status.enum");
let ActionItem = class ActionItem {
};
exports.ActionItem = ActionItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ActionItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'meeting_id', type: 'uuid' }),
    __metadata("design:type", String)
], ActionItem.prototype, "meetingId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => meeting_entity_1.Meeting, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'meeting_id' }),
    __metadata("design:type", meeting_entity_1.Meeting)
], ActionItem.prototype, "meeting", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ActionItem.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'assigned_to', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], ActionItem.prototype, "assignedTo", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'assigned_to' }),
    __metadata("design:type", user_entity_1.User)
], ActionItem.prototype, "assignee", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'due_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ActionItem.prototype, "dueAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'completed_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ActionItem.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: action_item_status_enum_1.ActionItemStatus.PENDING }),
    __metadata("design:type", String)
], ActionItem.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ActionItem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ActionItem.prototype, "updatedAt", void 0);
exports.ActionItem = ActionItem = __decorate([
    (0, typeorm_1.Entity)('action_items')
], ActionItem);
