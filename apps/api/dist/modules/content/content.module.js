"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const content_grid_entity_1 = require("./content-grid.entity");
const content_item_entity_1 = require("./content-item.entity");
const content_controller_1 = require("./content.controller");
const create_content_grid_use_case_1 = require("./create-content-grid.use-case");
const list_content_grids_use_case_1 = require("./list-content-grids.use-case");
const client_entity_1 = require("../clients/client.entity");
let ContentModule = class ContentModule {
};
exports.ContentModule = ContentModule;
exports.ContentModule = ContentModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([content_grid_entity_1.ContentGrid, content_item_entity_1.ContentItem, client_entity_1.Client])],
        controllers: [content_controller_1.ContentController],
        providers: [create_content_grid_use_case_1.CreateContentGridUseCase, list_content_grids_use_case_1.ListContentGridsUseCase],
    })
], ContentModule);
