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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicReservationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const public_decorator_1 = require("../../core/auth/decorators/public.decorator");
const reservations_service_1 = require("./application/reservations.service");
const reservation_dto_1 = require("./dto/reservation.dto");
let PublicReservationsController = class PublicReservationsController {
    constructor(service) {
        this.service = service;
    }
    eventSourceUrl(slug, candidate) {
        const publicOrigin = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
        const fallback = publicOrigin ? `${publicOrigin}/book/${encodeURIComponent(slug)}` : undefined;
        if (!candidate || !publicOrigin)
            return fallback;
        try {
            return new URL(candidate).origin === new URL(publicOrigin).origin ? candidate : fallback;
        }
        catch {
            return fallback;
        }
    }
    form(slug) {
        return this.service.publicForm(slug);
    }
    slots(slug, from, days, serviceId, resourceId) {
        return this.service.slots(slug, from, Number(days || 14), serviceId, resourceId);
    }
    event(slug, dto) {
        return this.service.trackPublicEvent(slug, dto);
    }
    async validateCoupon(slug, dto) {
        const code = dto.code?.trim();
        if (!code)
            throw new common_1.BadRequestException('CÃ³digo requerido');
        return this.service.validatePublicCoupon(slug, code, dto.startsAt ? new Date(dto.startsAt) : undefined);
    }
    survey(slug, dto, ipAddress, userAgent) {
        return this.service.createPublicSurveyResponse(slug, dto, ipAddress, userAgent, this.eventSourceUrl(slug, dto.eventSourceUrl));
    }
    create(slug, dto, ipAddress, userAgent) {
        return this.service.createPublic(slug, dto, ipAddress, userAgent, this.eventSourceUrl(slug, dto.eventSourceUrl));
    }
};
exports.PublicReservationsController = PublicReservationsController;
__decorate([
    (0, common_1.Get)(':slug'),
    (0, throttler_1.Throttle)({ default: { limit: 60, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PublicReservationsController.prototype, "form", null);
__decorate([
    (0, common_1.Get)(':slug/slots'),
    (0, throttler_1.Throttle)({ default: { limit: 120, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('days')),
    __param(3, (0, common_1.Query)('serviceId')),
    __param(4, (0, common_1.Query)('resourceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], PublicReservationsController.prototype, "slots", null);
__decorate([
    (0, common_1.Post)(':slug/events'),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, reservation_dto_1.PublicFormEventDto]),
    __metadata("design:returntype", void 0)
], PublicReservationsController.prototype, "event", null);
__decorate([
    (0, common_1.Post)(':slug/coupon-validate'),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, reservation_dto_1.CouponValidateDto]),
    __metadata("design:returntype", Promise)
], PublicReservationsController.prototype, "validateCoupon", null);
__decorate([
    (0, common_1.Post)(':slug/survey'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, reservation_dto_1.PublicSurveyResponseDto, String, Object]),
    __metadata("design:returntype", void 0)
], PublicReservationsController.prototype, "survey", null);
__decorate([
    (0, common_1.Post)(':slug'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Ip)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, reservation_dto_1.PublicReservationDto, String, Object]),
    __metadata("design:returntype", void 0)
], PublicReservationsController.prototype, "create", null);
exports.PublicReservationsController = PublicReservationsController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiTags)('Reservas pÃºblicas'),
    (0, common_1.Controller)('public/reservations'),
    __metadata("design:paramtypes", [reservations_service_1.ReservationsService])
], PublicReservationsController);
