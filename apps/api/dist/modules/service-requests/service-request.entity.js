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
exports.ServiceRequest = void 0;
const typeorm_1 = require("typeorm");
let ServiceRequest = class ServiceRequest {
};
exports.ServiceRequest = ServiceRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ServiceRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], ServiceRequest.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'received' }),
    __metadata("design:type", String)
], ServiceRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requester_name', type: 'varchar', length: 180 }),
    __metadata("design:type", String)
], ServiceRequest.prototype, "requesterName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requester_email', type: 'varchar', length: 190 }),
    __metadata("design:type", String)
], ServiceRequest.prototype, "requesterEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requester_rut', type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "requesterRut", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requester_phone', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "requesterPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "extra", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resolution_note', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "resolutionNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resolved_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "resolvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resolved_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], ServiceRequest.prototype, "resolvedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ServiceRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ServiceRequest.prototype, "updatedAt", void 0);
exports.ServiceRequest = ServiceRequest = __decorate([
    (0, typeorm_1.Entity)('service_requests'),
    (0, typeorm_1.Index)('IDX_service_requests_org_created', ['organizationId', 'createdAt']),
    (0, typeorm_1.Index)('IDX_service_requests_email', ['requesterEmail']),
    (0, typeorm_1.Index)('IDX_service_requests_status', ['status'])
], ServiceRequest);
