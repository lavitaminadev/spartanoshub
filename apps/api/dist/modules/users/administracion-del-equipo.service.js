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
exports.AdministracionDelEquipoService = void 0;
const common_1 = require("@nestjs/common");
const permission_resolver_service_1 = require("../../core/authorization/permission-resolver.service");
const account_access_service_1 = require("../../core/client-scope/account-access.service");
const user_role_enum_1 = require("../organizations/user-role.enum");
const CARGOS_INTERNOS = [user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.DEV, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR];
let AdministracionDelEquipoService = class AdministracionDelEquipoService {
    constructor(permisos, alcanceDeCuentas) {
        this.permisos = permisos;
        this.alcanceDeCuentas = alcanceDeCuentas;
    }
    async alcance(request, empresaPedida) {
        const rol = request.user.role;
        if (CARGOS_INTERNOS.includes(rol))
            return {};
        const organizacion = request.organizationId || request.user.organizationId;
        if (!organizacion)
            throw new common_1.ForbiddenException('Tu cuenta no administra personas');
        const alcanzables = await this.alcanceDeCuentas.allowedClientIds(organizacion, request.user);
        const empresa = empresaPedida && alcanzables?.includes(empresaPedida)
            ? empresaPedida
            : request.user.clientId;
        if (!empresa)
            throw new common_1.ForbiddenException('Tu cuenta no administra personas');
        const puede = await this.permisos.can(organizacion, request.user.id, rol, 'users', 'manage', empresa);
        if (!puede)
            throw new common_1.ForbiddenException('Tu cuenta no administra personas');
        return { soloEmpresa: empresa };
    }
    asegurarDentro(alcance, destino) {
        if (!alcance.soloEmpresa)
            return;
        if (destino.clientId !== alcance.soloEmpresa)
            throw new common_1.ForbiddenException('Esa cuenta es de otra empresa');
        if (destino.role && destino.role !== user_role_enum_1.UserRole.CLIENT)
            throw new common_1.ForbiddenException('Solo puedes administrar cuentas de tu empresa');
    }
};
exports.AdministracionDelEquipoService = AdministracionDelEquipoService;
exports.AdministracionDelEquipoService = AdministracionDelEquipoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [permission_resolver_service_1.PermissionResolverService,
        account_access_service_1.AccountAccessService])
], AdministracionDelEquipoService);
