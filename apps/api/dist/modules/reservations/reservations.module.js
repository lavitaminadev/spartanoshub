"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const reservation_form_entity_1 = require("./domain/reservation-form.entity");
const reservation_entity_1 = require("./domain/reservation.entity");
const availability_block_entity_1 = require("./domain/availability-block.entity");
const reservations_service_1 = require("./application/reservations.service");
const bulk_import_service_1 = require("./application/bulk-import.service");
const reservations_controller_1 = require("./reservations.controller");
const public_reservations_controller_1 = require("./public-reservations.controller");
const reservation_event_entity_1 = require("./domain/reservation-event.entity");
const reservation_form_event_entity_1 = require("./domain/reservation-form-event.entity");
const reservation_coupon_entity_1 = require("./domain/reservation-coupon.entity");
const survey_contact_request_entity_1 = require("./domain/survey-contact-request.entity");
const crm_module_1 = require("../crm/crm.module");
const google_module_1 = require("../integrations/google/google.module");
const meta_module_1 = require("../integrations/meta/meta.module");
const notifications_module_1 = require("../../core/notifications/notifications.module");
const audit_module_1 = require("../../core/audit/audit.module");
let ReservationsModule = class ReservationsModule {
};
exports.ReservationsModule = ReservationsModule;
exports.ReservationsModule = ReservationsModule = __decorate([
    (0, common_1.Module)({ imports: [typeorm_1.TypeOrmModule.forFeature([reservation_form_entity_1.ReservationForm, reservation_entity_1.Reservation, availability_block_entity_1.AvailabilityBlock, reservation_event_entity_1.ReservationEvent, reservation_form_event_entity_1.ReservationFormEvent, reservation_coupon_entity_1.ReservationCoupon, survey_contact_request_entity_1.SurveyContactRequest]), crm_module_1.CrmModule, google_module_1.GoogleModule, meta_module_1.MetaModule, notifications_module_1.NotificationsModule, audit_module_1.AuditModule], providers: [reservations_service_1.ReservationsService, bulk_import_service_1.ReservationsBulkImportService], controllers: [reservations_controller_1.ReservationsController, public_reservations_controller_1.PublicReservationsController], exports: [reservations_service_1.ReservationsService] })
], ReservationsModule);
