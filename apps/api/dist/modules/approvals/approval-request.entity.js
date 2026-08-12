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
exports.ApprovalRequest = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("../organizations/organization.entity");
const client_entity_1 = require("../clients/client.entity");
const user_entity_1 = require("../users/user.entity");
const approval_request_status_enum_1 = require("./approval-request-status.enum");
let ApprovalRequest = class ApprovalRequest {
};
exports.ApprovalRequest = ApprovalRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], ApprovalRequest.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => client_entity_1.Client, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'client_id' }),
    __metadata("design:type", client_entity_1.Client)
], ApprovalRequest.prototype, "client", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'entity_type', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "entityType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'entity_id', type: 'uuid' }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "entityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requested_by', type: 'uuid' }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "requestedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'requested_by' }),
    __metadata("design:type", user_entity_1.User)
], ApprovalRequest.prototype, "requestedByUser", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'assigned_to', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "assignedTo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: approval_request_status_enum_1.ApprovalRequestStatus.PENDING }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'decision_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ApprovalRequest.prototype, "decisionAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'decision_notes', type: 'text', nullable: true }),
    __metadata("design:type", String)
], ApprovalRequest.prototype, "decisionNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'due_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ApprovalRequest.prototype, "dueAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ApprovalRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ApprovalRequest.prototype, "updatedAt", void 0);
exports.ApprovalRequest = ApprovalRequest = __decorate([
    (0, typeorm_1.Entity)('approval_requests'),
    (0, typeorm_1.Index)('IDX_approval_requests_org_created', ['organizationId', 'createdAt'])
], ApprovalRequest);
