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
exports.ContentItem = void 0;
const typeorm_1 = require("typeorm");
const content_grid_entity_1 = require("./content-grid.entity");
const content_item_type_enum_1 = require("./content-item-type.enum");
const content_item_status_enum_1 = require("./content-item-status.enum");
let ContentItem = class ContentItem {
};
exports.ContentItem = ContentItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ContentItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'content_grid_id', type: 'uuid' }),
    __metadata("design:type", String)
], ContentItem.prototype, "contentGridId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => content_grid_entity_1.ContentGrid, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'content_grid_id' }),
    __metadata("design:type", content_grid_entity_1.ContentGrid)
], ContentItem.prototype, "contentGrid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], ContentItem.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], ContentItem.prototype, "caption", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: content_item_status_enum_1.ContentItemStatus.PLANNED }),
    __metadata("design:type", String)
], ContentItem.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scheduled_at', type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ContentItem.prototype, "scheduledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'piece_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], ContentItem.prototype, "pieceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ContentItem.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ContentItem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ContentItem.prototype, "updatedAt", void 0);
exports.ContentItem = ContentItem = __decorate([
    (0, typeorm_1.Entity)('content_items')
], ContentItem);
//# sourceMappingURL=content-item.entity.js.map