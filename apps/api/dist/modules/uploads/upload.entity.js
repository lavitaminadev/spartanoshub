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
exports.Upload = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("../organizations/organization.entity");
let Upload = class Upload {
};
exports.Upload = Upload;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Upload.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Upload.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], Upload.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_name', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Upload.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'original_name', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Upload.prototype, "originalName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mime_type', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], Upload.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], Upload.prototype, "size", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500 }),
    __metadata("design:type", String)
], Upload.prototype, "path", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'drive_file_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Upload.prototype, "driveFileId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'uploaded_by', type: 'uuid' }),
    __metadata("design:type", String)
], Upload.prototype, "uploadedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Upload.prototype, "createdAt", void 0);
exports.Upload = Upload = __decorate([
    (0, typeorm_1.Entity)('uploads')
], Upload);
//# sourceMappingURL=upload.entity.js.map