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
exports.ContentGrid = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("../organizations/organization.entity");
const client_entity_1 = require("../clients/client.entity");
const content_grid_status_enum_1 = require("./content-grid-status.enum");
const content_item_entity_1 = require("./content-item.entity");
let ContentGrid = class ContentGrid {
};
exports.ContentGrid = ContentGrid;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ContentGrid.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ContentGrid.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], ContentGrid.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], ContentGrid.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => client_entity_1.Client, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'client_id' }),
    __metadata("design:type", client_entity_1.Client)
], ContentGrid.prototype, "client", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => content_item_entity_1.ContentItem, (item) => item.contentGrid),
    __metadata("design:type", Array)
], ContentGrid.prototype, "contentItems", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], ContentGrid.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'week_start', type: 'date' }),
    __metadata("design:type", Date)
], ContentGrid.prototype, "weekStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'week_end', type: 'date' }),
    __metadata("design:type", Date)
], ContentGrid.prototype, "weekEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: content_grid_status_enum_1.ContentGridStatus.DRAFT }),
    __metadata("design:type", String)
], ContentGrid.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'notes', type: 'text', nullable: true }),
    __metadata("design:type", String)
], ContentGrid.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ContentGrid.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ContentGrid.prototype, "updatedAt", void 0);
exports.ContentGrid = ContentGrid = __decorate([
    (0, typeorm_1.Entity)('content_grids')
], ContentGrid);
