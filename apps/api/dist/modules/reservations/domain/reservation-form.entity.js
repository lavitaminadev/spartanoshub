"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationForm = void 0;
const typeorm_1 = require("typeorm");
let ReservationForm = class ReservationForm {
};
exports.ReservationForm = ReservationForm;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ReservationForm.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationForm.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationForm.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 180 }),
    __metadata("design:type", String)
], ReservationForm.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'public_slug', type: 'varchar', length: 190 }),
    __metadata("design:type", String)
], ReservationForm.prototype, "publicSlug", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 24, default: 'draft' }),
    __metadata("design:type", String)
], ReservationForm.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, default: 'appointment' }),
    __metadata("design:type", String)
], ReservationForm.prototype, "mode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80, default: 'America/Santiago' }),
    __metadata("design:type", String)
], ReservationForm.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'duration_minutes', type: 'smallint', default: 60 }),
    __metadata("design:type", Number)
], ReservationForm.prototype, "durationMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'buffer_minutes', type: 'smallint', default: 0 }),
    __metadata("design:type", Number)
], ReservationForm.prototype, "bufferMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'capacity_per_slot', type: 'smallint', default: 1 }),
    __metadata("design:type", Number)
], ReservationForm.prototype, "capacityPerSlot", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'daily_capacity', type: 'smallint', default: 0 }),
    __metadata("design:type", Number)
], ReservationForm.prototype, "dailyCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'minimum_notice_hours', type: 'smallint', default: 2 }),
    __metadata("design:type", Number)
], ReservationForm.prototype, "minimumNoticeHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'maximum_advance_days', type: 'smallint', default: 60 }),
    __metadata("design:type", Number)
], ReservationForm.prototype, "maximumAdvanceDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'confirmation_mode', type: 'varchar', length: 20, default: 'automatic' }),
    __metadata("design:type", String)
], ReservationForm.prototype, "confirmationMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'field_schema', type: 'json' }),
    __metadata("design:type", Array)
], ReservationForm.prototype, "fieldSchema", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'design_config', type: 'json' }),
    __metadata("design:type", Object)
], ReservationForm.prototype, "designConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'schedule_config', type: 'json' }),
    __metadata("design:type", Object)
], ReservationForm.prototype, "scheduleConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'services_config', type: 'json', nullable: true }),
    __metadata("design:type", Array)
], ReservationForm.prototype, "servicesConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resources_config', type: 'json', nullable: true }),
    __metadata("design:type", Array)
], ReservationForm.prototype, "resourcesConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'campaign_id', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", String)
], ReservationForm.prototype, "campaignId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'crm_enabled', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ReservationForm.prototype, "crmEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'calendar_enabled', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ReservationForm.prototype, "calendarEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'meta_capi_enabled', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ReservationForm.prototype, "metaCapiEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ga4_measurement_id', type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], ReservationForm.prototype, "ga4MeasurementId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'team_notifications', type: 'json', nullable: true }),
    __metadata("design:type", Array)
], ReservationForm.prototype, "teamNotifications", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationForm.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ReservationForm.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ReservationForm.prototype, "updatedAt", void 0);
exports.ReservationForm = ReservationForm = __decorate([
    (0, typeorm_1.Entity)('reservation_forms'),
    (0, typeorm_1.Index)('UQ_reservation_forms_public_slug', ['publicSlug'], { unique: true })
], ReservationForm);
//# sourceMappingURL=reservation-form.entity.js.map