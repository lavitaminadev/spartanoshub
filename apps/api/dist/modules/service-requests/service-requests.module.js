"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceRequestsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const service_request_entity_1 = require("./service-request.entity");
const service_requests_service_1 = require("./service-requests.service");
const service_requests_controller_1 = require("./service-requests.controller");
const data_protection_module_1 = require("../../core/data-protection/data-protection.module");
const audit_module_1 = require("../../core/audit/audit.module");
const user_entity_1 = require("../users/user.entity");
const lead_entity_1 = require("../crm/leads/lead.entity");
const contact_entity_1 = require("../crm/contacts/contact.entity");
const reservation_entity_1 = require("../reservations/domain/reservation.entity");
let ServiceRequestsModule = class ServiceRequestsModule {
};
exports.ServiceRequestsModule = ServiceRequestsModule;
exports.ServiceRequestsModule = ServiceRequestsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([service_request_entity_1.ServiceRequest, user_entity_1.User, lead_entity_1.Lead, contact_entity_1.Contact, reservation_entity_1.Reservation]),
            data_protection_module_1.DataProtectionModule,
            audit_module_1.AuditModule,
        ],
        controllers: [service_requests_controller_1.ServiceRequestsController],
        providers: [service_requests_service_1.ServiceRequestsService],
        exports: [service_requests_service_1.ServiceRequestsService],
    })
], ServiceRequestsModule);
