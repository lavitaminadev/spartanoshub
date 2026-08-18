"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessTemplatesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const process_template_entity_1 = require("./process-template.entity");
const process_templates_controller_1 = require("./process-templates.controller");
const process_templates_service_1 = require("./process-templates.service");
let ProcessTemplatesModule = class ProcessTemplatesModule {
};
exports.ProcessTemplatesModule = ProcessTemplatesModule;
exports.ProcessTemplatesModule = ProcessTemplatesModule = __decorate([
    (0, common_1.Module)({ imports: [typeorm_1.TypeOrmModule.forFeature([process_template_entity_1.ProcessTemplate])], controllers: [process_templates_controller_1.ProcessTemplatesController], providers: [process_templates_service_1.ProcessTemplatesService], exports: [process_templates_service_1.ProcessTemplatesService] })
], ProcessTemplatesModule);
