"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataProtectionModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const user_entity_1 = require("../../modules/users/user.entity");
const lead_entity_1 = require("../../modules/crm/leads/lead.entity");
const audit_entity_1 = require("../audit/audit.entity");
const consent_entity_1 = require("./consent.entity");
const consent_version_entity_1 = require("./consent-version.entity");
const contact_entity_1 = require("../../modules/crm/contacts/contact.entity");
const reservation_entity_1 = require("../../modules/reservations/domain/reservation.entity");
const data_protection_service_1 = require("./data-protection.service");
const data_protection_controller_1 = require("./data-protection.controller");
const consent_controller_1 = require("./consent.controller");
const audit_module_1 = require("../audit/audit.module");
const parameters_module_1 = require("../parameters/parameters.module");
const service_request_entity_1 = require("../../modules/service-requests/service-request.entity");
let DataProtectionModule = class DataProtectionModule {
};
exports.DataProtectionModule = DataProtectionModule;
exports.DataProtectionModule = DataProtectionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, lead_entity_1.Lead, audit_entity_1.AuditLog, consent_entity_1.DataConsent, consent_version_entity_1.ConsentVersion, contact_entity_1.Contact, reservation_entity_1.Reservation, service_request_entity_1.ServiceRequest]),
            audit_module_1.AuditModule,
            parameters_module_1.ParametersModule,
        ],
        controllers: [data_protection_controller_1.DataProtectionController, consent_controller_1.ConsentController],
        providers: [data_protection_service_1.DataProtectionService],
        exports: [data_protection_service_1.DataProtectionService],
    })
], DataProtectionModule);
