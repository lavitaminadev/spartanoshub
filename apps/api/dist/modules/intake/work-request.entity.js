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
exports.WorkRequest = exports.WORK_REQUEST_PRIORITIES = exports.WorkRequestStatus = exports.WorkRequestArea = void 0;
const typeorm_1 = require("typeorm");
const client_entity_1 = require("../clients/client.entity");
const user_entity_1 = require("../users/user.entity");
var WorkRequestArea;
(function (WorkRequestArea) {
    WorkRequestArea["DESIGN"] = "design";
    WorkRequestArea["AUDIOVISUAL"] = "audiovisual";
    WorkRequestArea["COMMUNITY"] = "community";
})(WorkRequestArea || (exports.WorkRequestArea = WorkRequestArea = {}));
var WorkRequestStatus;
(function (WorkRequestStatus) {
    WorkRequestStatus["NEW"] = "new";
    WorkRequestStatus["IN_REVIEW"] = "in_review";
    WorkRequestStatus["ACCEPTED"] = "accepted";
    WorkRequestStatus["CONVERTED"] = "converted";
    WorkRequestStatus["REJECTED"] = "rejected";
})(WorkRequestStatus || (exports.WorkRequestStatus = WorkRequestStatus = {}));
exports.WORK_REQUEST_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
let WorkRequest = class WorkRequest {
};
exports.WorkRequest = WorkRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WorkRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], WorkRequest.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], WorkRequest.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => client_entity_1.Client),
    (0, typeorm_1.JoinColumn)({ name: 'client_id' }),
    __metadata("design:type", client_entity_1.Client)
], WorkRequest.prototype, "client", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], WorkRequest.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], WorkRequest.prototype, "area", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], WorkRequest.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WorkRequest.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'normal' }),
    __metadata("design:type", String)
], WorkRequest.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: WorkRequestStatus.NEW }),
    __metadata("design:type", String)
], WorkRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'needed_by', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], WorkRequest.prototype, "neededBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requested_by', type: 'uuid' }),
    __metadata("design:type", String)
], WorkRequest.prototype, "requestedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'requested_by' }),
    __metadata("design:type", user_entity_1.User)
], WorkRequest.prototype, "requester", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'assigned_to', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], WorkRequest.prototype, "assignedTo", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'assigned_to' }),
    __metadata("design:type", Object)
], WorkRequest.prototype, "assignee", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'creative_fields', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], WorkRequest.prototype, "creativeFields", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'operational_fields', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], WorkRequest.prototype, "operationalFields", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rejection_reason', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], WorkRequest.prototype, "rejectionReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'piece_ids', type: 'json', nullable: true }),
    __metadata("design:type", Object)
], WorkRequest.prototype, "pieceIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'session_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], WorkRequest.prototype, "sessionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reviewed_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], WorkRequest.prototype, "reviewedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resolved_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], WorkRequest.prototype, "resolvedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], WorkRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], WorkRequest.prototype, "updatedAt", void 0);
exports.WorkRequest = WorkRequest = __decorate([
    (0, typeorm_1.Entity)('work_requests'),
    (0, typeorm_1.Index)('IDX_work_requests_org_status', ['organizationId', 'status']),
    (0, typeorm_1.Index)('IDX_work_requests_org_client', ['organizationId', 'clientId']),
    (0, typeorm_1.Index)('IDX_work_requests_assignee', ['organizationId', 'assignedTo'])
], WorkRequest);
//# sourceMappingURL=work-request.entity.js.map