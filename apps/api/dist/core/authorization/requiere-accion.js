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
exports.AccionGuard = exports.RequiereAccion = exports.REQUIERE_ACCION_KEY = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const acciones_1 = require("./acciones");
const acciones_service_1 = require("./acciones.service");
exports.REQUIERE_ACCION_KEY = 'requiere-accion';
const RequiereAccion = (clave) => (0, common_1.SetMetadata)(exports.REQUIERE_ACCION_KEY, clave);
exports.RequiereAccion = RequiereAccion;
let AccionGuard = class AccionGuard {
    constructor(reflector, acciones) {
        this.reflector = reflector;
        this.acciones = acciones;
    }
    async canActivate(context) {
        const clave = this.reflector.getAllAndOverride(exports.REQUIERE_ACCION_KEY, [context.getHandler(), context.getClass()]);
        if (!clave)
            return true;
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const organizationId = request.organizationId ?? user?.organizationId;
        if (!user?.id || !organizationId)
            throw new common_1.ForbiddenException('No se pudo determinar el usuario');
        if (await this.acciones.puede(organizationId, user.id, user.role, clave))
            return true;
        throw new common_1.ForbiddenException(`No tienes permiso para ${(0, acciones_1.definicionDeAccion)(clave)?.nombre.toLowerCase() ?? 'esta acción'}`);
    }
};
exports.AccionGuard = AccionGuard;
exports.AccionGuard = AccionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector, acciones_service_1.AccionesService])
], AccionGuard);
