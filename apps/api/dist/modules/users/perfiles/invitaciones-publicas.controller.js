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
exports.InvitacionesPublicasController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const public_decorator_1 = require("../../../core/auth/decorators/public.decorator");
const perfiles_dto_1 = require("./perfiles.dto");
const invitaciones_service_1 = require("./invitaciones.service");
let InvitacionesPublicasController = class InvitacionesPublicasController {
    constructor(invitaciones) {
        this.invitaciones = invitaciones;
    }
    vistaPrevia(token) {
        return this.invitaciones.vistaPrevia(token);
    }
    aceptar(token, dto) {
        return this.invitaciones.aceptar(token, dto);
    }
};
exports.InvitacionesPublicasController = InvitacionesPublicasController;
__decorate([
    (0, common_1.Get)(':token'),
    (0, throttler_1.Throttle)({ default: { limit: 20, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InvitacionesPublicasController.prototype, "vistaPrevia", null);
__decorate([
    (0, common_1.Post)(':token/aceptar'),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, perfiles_dto_1.AceptarInvitacionDto]),
    __metadata("design:returntype", void 0)
], InvitacionesPublicasController.prototype, "aceptar", null);
exports.InvitacionesPublicasController = InvitacionesPublicasController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiTags)('Invitaciones al equipo'),
    (0, common_1.Controller)('public/invitaciones-equipo'),
    __metadata("design:paramtypes", [invitaciones_service_1.InvitacionesService])
], InvitacionesPublicasController);
