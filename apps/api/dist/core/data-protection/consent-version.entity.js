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
exports.ConsentVersion = void 0;
const typeorm_1 = require("typeorm");
let ConsentVersion = class ConsentVersion {
};
exports.ConsentVersion = ConsentVersion;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ConsentVersion.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', length: 36 }),
    __metadata("design:type", String)
], ConsentVersion.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ConsentVersion.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 200 }),
    __metadata("design:type", String)
], ConsentVersion.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ConsentVersion.prototype, "text", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'published_at' }),
    __metadata("design:type", Date)
], ConsentVersion.prototype, "publishedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'published_by', length: 36, nullable: true }),
    __metadata("design:type", Object)
], ConsentVersion.prototype, "publishedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ConsentVersion.prototype, "active", void 0);
exports.ConsentVersion = ConsentVersion = __decorate([
    (0, typeorm_1.Entity)('consent_versions'),
    (0, typeorm_1.Index)('IDX_consent_version_active', ['organizationId', 'active'])
], ConsentVersion);
