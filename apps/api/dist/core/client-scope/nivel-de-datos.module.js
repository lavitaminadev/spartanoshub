"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NivelDeDatosModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const nivel_de_datos_service_1 = require("./nivel-de-datos.service");
const perfil_asignacion_entity_1 = require("../../modules/users/perfiles/perfil-asignacion.entity");
const perfil_de_empresa_entity_1 = require("../../modules/users/perfiles/perfil-de-empresa.entity");
const users_module_1 = require("../../modules/users/users.module");
let NivelDeDatosModule = class NivelDeDatosModule {
};
exports.NivelDeDatosModule = NivelDeDatosModule;
exports.NivelDeDatosModule = NivelDeDatosModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([perfil_asignacion_entity_1.PerfilAsignacion, perfil_de_empresa_entity_1.PerfilDeEmpresa]), users_module_1.UsersModule],
        providers: [nivel_de_datos_service_1.NivelDeDatosService],
        exports: [nivel_de_datos_service_1.NivelDeDatosService],
    })
], NivelDeDatosModule);
