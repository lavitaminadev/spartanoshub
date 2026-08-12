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
exports.Document = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("../organizations/organization.entity");
const client_entity_1 = require("../clients/client.entity");
const user_entity_1 = require("../users/user.entity");
let Document = class Document {
};
exports.Document = Document;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Document.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Document.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], Document.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Document.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => client_entity_1.Client, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'client_id' }),
    __metadata("design:type", client_entity_1.Client)
], Document.prototype, "client", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Document.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'other' }),
    __metadata("design:type", String)
], Document.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_url', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], Document.prototype, "fileUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'drive_file_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Document.prototype, "driveFileId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], Document.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'draft' }),
    __metadata("design:type", String)
], Document.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'uploaded_by', type: 'uuid' }),
    __metadata("design:type", String)
], Document.prototype, "uploadedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'uploaded_by' }),
    __metadata("design:type", user_entity_1.User)
], Document.prototype, "uploader", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], Document.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Document.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Document.prototype, "updatedAt", void 0);
exports.Document = Document = __decorate([
    (0, typeorm_1.Entity)('documents')
], Document);
