"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const client_entity_1 = require("./client.entity");
const clients_controller_1 = require("./clients.controller");
const create_client_use_case_1 = require("./create-client.use-case");
const list_clients_use_case_1 = require("./list-clients.use-case");
const get_client_use_case_1 = require("./get-client.use-case");
const client_overview_service_1 = require("./client-overview.service");
const user_entity_1 = require("../users/user.entity");
const lead_entity_1 = require("../crm/leads/lead.entity");
const users_module_1 = require("../users/users.module");
const consent_version_entity_1 = require("../../core/data-protection/consent-version.entity");
const consent_entity_1 = require("../../core/data-protection/consent.entity");
const audit_module_1 = require("../../core/audit/audit.module");
const detalle_de_contacto_en_avisos_1 = require("./detalle-de-contacto-en-avisos");
const parameters_module_1 = require("../../core/parameters/parameters.module");
let ClientsModule = class ClientsModule {
};
exports.ClientsModule = ClientsModule;
exports.ClientsModule = ClientsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([client_entity_1.Client, user_entity_1.User, lead_entity_1.Lead, consent_version_entity_1.ConsentVersion, consent_entity_1.DataConsent]), parameters_module_1.ParametersModule, users_module_1.UsersModule, audit_module_1.AuditModule],
        controllers: [clients_controller_1.ClientsController],
        providers: [create_client_use_case_1.CreateClientUseCase, list_clients_use_case_1.ListClientsUseCase, get_client_use_case_1.GetClientUseCase, client_overview_service_1.ClientOverviewService, detalle_de_contacto_en_avisos_1.DetalleDeContactoEnAvisosService],
    })
], ClientsModule);
