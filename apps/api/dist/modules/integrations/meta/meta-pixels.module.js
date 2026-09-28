"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaPixelsModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const typeorm_1 = require("@nestjs/typeorm");
const client_entity_1 = require("../../clients/client.entity");
const integration_entity_1 = require("../integration.entity");
const meta_client_pixel_service_1 = require("./meta-client-pixel.service");
const meta_pixel_entity_1 = require("./meta-pixel.entity");
const meta_pixel_service_1 = require("./meta-pixel.service");
let MetaPixelsModule = class MetaPixelsModule {
};
exports.MetaPixelsModule = MetaPixelsModule;
exports.MetaPixelsModule = MetaPixelsModule = __decorate([
    (0, common_1.Module)({
        imports: [axios_1.HttpModule, typeorm_1.TypeOrmModule.forFeature([integration_entity_1.Integration, client_entity_1.Client, meta_pixel_entity_1.MetaPixel])],
        providers: [meta_pixel_service_1.MetaPixelService, meta_client_pixel_service_1.MetaClientPixelService],
        exports: [meta_pixel_service_1.MetaPixelService, meta_client_pixel_service_1.MetaClientPixelService],
    })
], MetaPixelsModule);
