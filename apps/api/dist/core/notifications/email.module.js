"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const parameter_definition_entity_1 = require("../parameters/parameter-definition.entity");
const parameter_value_entity_1 = require("../parameters/parameter-value.entity");
const parameter_resolver_service_1 = require("../parameters/parameter-resolver.service");
const email_service_1 = require("./email.service");
const registro_de_correo_entity_1 = require("./registro-de-correo.entity");
const registro_de_correos_controller_1 = require("./registro-de-correos.controller");
let EmailModule = class EmailModule {
};
exports.EmailModule = EmailModule;
exports.EmailModule = EmailModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([parameter_definition_entity_1.ParameterDefinition, parameter_value_entity_1.ParameterValue, registro_de_correo_entity_1.RegistroDeCorreo])],
        controllers: [registro_de_correos_controller_1.RegistroDeCorreosController],
        providers: [email_service_1.EmailService, parameter_resolver_service_1.ParameterResolver],
        exports: [email_service_1.EmailService],
    })
], EmailModule);
