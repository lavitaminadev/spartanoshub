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
exports.PortalHomeController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
const client_capability_service_1 = require("../../core/client-scope/client-capability.service");
const crm_home_service_1 = require("../crm/leads/crm-home.service");
const reservation_entity_1 = require("../reservations/domain/reservation.entity");
const user_role_enum_1 = require("../organizations/user-role.enum");
let PortalHomeController = class PortalHomeController {
    constructor(crmHome, capacidades, reservas) {
        this.crmHome = crmHome;
        this.capacidades = capacidades;
        this.reservas = reservas;
    }
    async inicio(req) {
        if (req.user.role !== user_role_enum_1.UserRole.CLIENT) {
            throw new common_1.ForbiddenException('Este resumen es del portal de una empresa cliente');
        }
        const clientId = req.user.clientId;
        if (!clientId)
            throw new common_1.ForbiddenException('La cuenta cliente no está asociada a una empresa');
        const [tieneCrm, tieneReservas] = await Promise.all([
            this.capacidades.tiene(req.organizationId, clientId, 'crm'),
            this.capacidades.tiene(req.organizationId, clientId, 'reservations'),
        ]);
        const [crm, reservas] = await Promise.all([
            tieneCrm ? this.bloqueCrm(req.organizationId, clientId) : Promise.resolve(undefined),
            tieneReservas ? this.bloqueReservas(req.organizationId, clientId) : Promise.resolve(undefined),
        ]);
        return { crm, reservas };
    }
    async bloqueCrm(organizationId, clientId) {
        const home = await this.crmHome.home(organizationId, 7, { domain: 'commercial', clientId });
        return {
            leadsDelMes: home.month?.leads ?? 0,
            pendientes: (home.alerts ?? [])
                .filter((aviso) => ['sin_contactar', 'calificados_sin_visita'].includes(aviso.key))
                .map((aviso) => ({
                key: aviso.key, count: aviso.count, level: aviso.level,
            })),
        };
    }
    async bloqueReservas(organizationId, clientId) {
        const desde = new Date();
        desde.setHours(0, 0, 0, 0);
        const hasta = new Date(desde);
        hasta.setDate(hasta.getDate() + 2);
        const [proximas, sinConfirmar] = await Promise.all([
            this.reservas.count({
                where: {
                    organizationId, clientId,
                    startsAt: (0, typeorm_2.Between)(desde, hasta),
                    status: (0, typeorm_2.In)(['pending', 'confirmed', 'rescheduled']),
                },
            }),
            this.reservas.count({ where: { organizationId, clientId, status: 'pending' } }),
        ]);
        return { proximasDosDias: proximas, sinConfirmar };
    }
};
exports.PortalHomeController = PortalHomeController;
__decorate([
    (0, common_1.Get)('inicio'),
    (0, swagger_1.ApiOperation)({ summary: 'Qué tiene que atender hoy esta empresa' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PortalHomeController.prototype, "inicio", null);
exports.PortalHomeController = PortalHomeController = __decorate([
    (0, swagger_1.ApiTags)('Portal del cliente'),
    (0, module_scope_decorator_1.ModuleExempt)('Resumen del portal: reune CRM y Reservas, y cada bloque va detras de su capacidad'),
    (0, common_1.Controller)('portal'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    __param(2, (0, typeorm_1.InjectRepository)(reservation_entity_1.Reservation)),
    __metadata("design:paramtypes", [crm_home_service_1.CrmHomeService,
        client_capability_service_1.ClientCapabilityService,
        typeorm_2.Repository])
], PortalHomeController);
