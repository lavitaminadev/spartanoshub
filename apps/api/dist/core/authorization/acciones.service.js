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
exports.AccionesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const acciones_1 = require("./acciones");
const permission_level_1 = require("./permission-level");
const permission_resolver_service_1 = require("./permission-resolver.service");
const user_action_override_entity_1 = require("./user-action-override.entity");
let AccionesService = class AccionesService {
    constructor(ajustes, permisos) {
        this.ajustes = ajustes;
        this.permisos = permisos;
    }
    async explicar(organizationId, userId, role) {
        const [niveles, filas] = await Promise.all([
            this.permisos.permissionsFor(organizationId, userId, role),
            this.ajustes.find({ where: { organizationId, userId } }),
        ]);
        const porAccion = new Map(filas.map((fila) => [fila.action, fila]));
        return acciones_1.ACCIONES.map((accion) => {
            const porNivel = (0, permission_level_1.satisfies)(niveles[accion.modulo] ?? 'none', accion.nivelPorDefecto);
            const ajuste = porAccion.get(accion.clave);
            const permitida = ajuste ? ajuste.allowed && (niveles[accion.modulo] ?? 'none') !== 'none' : porNivel;
            return { clave: accion.clave, modulo: accion.modulo, nombre: accion.nombre, ayuda: accion.ayuda, permitida, porNivel, origen: ajuste ? 'ajuste' : 'nivel' };
        });
    }
    async puede(organizationId, userId, role, clave) {
        if (role === user_role_enum_1.UserRole.DEV)
            return true;
        if (!(0, acciones_1.definicionDeAccion)(clave))
            return false;
        const acciones = await this.explicar(organizationId, userId, role);
        return acciones.find((accion) => accion.clave === clave)?.permitida ?? false;
    }
};
exports.AccionesService = AccionesService;
exports.AccionesService = AccionesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_action_override_entity_1.UserActionOverride)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        permission_resolver_service_1.PermissionResolverService])
], AccionesService);
