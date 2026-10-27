"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VulneracionesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const client_entity_1 = require("../clients/client.entity");
const vulneracion_entity_1 = require("./vulneracion.entity");
const vulneraciones_controller_1 = require("./vulneraciones.controller");
const vulneraciones_service_1 = require("./vulneraciones.service");
let VulneracionesModule = class VulneracionesModule {
};
exports.VulneracionesModule = VulneracionesModule;
exports.VulneracionesModule = VulneracionesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([vulneracion_entity_1.Vulneracion, client_entity_1.Client])],
        controllers: [vulneraciones_controller_1.VulneracionesController],
        providers: [vulneraciones_service_1.VulneracionesService],
    })
], VulneracionesModule);
