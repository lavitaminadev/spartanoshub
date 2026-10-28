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
var PerfilesController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerfilesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const roles_decorator_1 = require("../../../core/authorization/roles.decorator");
const module_scope_decorator_1 = require("../../../core/authorization/module-scope.decorator");
const requires_recent_auth_decorator_1 = require("../../../core/auth/requires-recent-auth.decorator");
const account_access_service_1 = require("../../../core/client-scope/account-access.service");
const user_role_enum_1 = require("../../organizations/user-role.enum");
const administracion_del_equipo_service_1 = require("../administracion-del-equipo.service");
const perfiles_dto_1 = require("./perfiles.dto");
const invitaciones_service_1 = require("./invitaciones.service");
const perfiles_service_1 = require("./perfiles.service");
const requiere_area_decorator_1 = require("../../../core/authorization/requiere-area.decorator");
const CARGOS = [user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.DEV, user_role_enum_1.UserRole.CLIENT];
let PerfilesController = PerfilesController_1 = class PerfilesController {
    constructor(perfiles, invitaciones, administracion, accesos) {
        this.perfiles = perfiles;
        this.invitaciones = invitaciones;
        this.administracion = administracion;
        this.accesos = accesos;
    }
    async contexto(req, clientId) {
        const alcance = await this.administracion.alcance(req, clientId);
        const organizationId = req.organizationId || req.user.organizationId;
        const empresa = alcance.soloEmpresa ?? clientId;
        if (!empresa)
            throw new common_1.BadRequestException('Elige la empresa');
        if (!alcance.soloEmpresa)
            await this.accesos.assertClient(organizationId, req.user, empresa);
        return { organizationId, clientId: empresa, actorId: req.user.id, esAgencia: !alcance.soloEmpresa, ip: req.ip };
    }
    async contextoParaEscribir(req, clientId) {
        const ctx = await this.contexto(req, clientId);
        const cargo = req.user.role;
        if (ctx.esAgencia && !PerfilesController_1.ADMINISTRAN.includes(cargo)) {
            throw new common_1.ForbiddenException('Desde tu cargo esta configuración se consulta, no se cambia: la decide quien administra el local.');
        }
        return ctx;
    }
    async listar(req, clientId) {
        return { data: await this.perfiles.listar(await this.contexto(req, clientId)) };
    }
    async asignaciones(req, clientId) {
        return { data: await this.perfiles.asignacionesDeLaEmpresa(await this.contexto(req, clientId)) };
    }
    async queVe(req, userId, clientId) {
        return this.perfiles.queVe(await this.contexto(req, clientId), userId);
    }
    async reingresos(req, clientId) {
        return { data: await this.perfiles.reingresos(await this.contexto(req, clientId)) };
    }
    async texto(req, clientId) {
        const ctx = await this.contexto(req, clientId);
        return this.perfiles.textoDeConfidencialidad(ctx.organizationId);
    }
    async sugeridos(req, clientId) {
        const ctx = await this.contextoParaEscribir(req, clientId);
        return { copiados: await this.perfiles.sembrarSugeridos(ctx.organizationId, ctx.clientId) };
    }
    async pendientes(req, clientId) {
        return { data: await this.invitaciones.pendientes(await this.contexto(req, clientId)) };
    }
    async invitar(req, dto, clientId) {
        const ctx = await this.contextoParaEscribir(req, clientId);
        const respuesta = await this.invitaciones.invitar(ctx, dto, req.user.id);
        return { ...respuesta, mensaje: 'Invitación enviada' };
    }
    async cancelar(req, id, clientId) {
        await this.invitaciones.cancelar(await this.contextoParaEscribir(req, clientId), id);
        return { cancelada: true };
    }
    async asignar(req, userId, dto, clientId) {
        await this.perfiles.asignar(await this.contextoParaEscribir(req, clientId), userId, dto.perfilId ?? null);
        return { userId, perfilId: dto.perfilId ?? null };
    }
    async quitar(req, userId, motivo, vetar, clientId) {
        return this.perfiles.quitarDelEquipo(await this.contextoParaEscribir(req, clientId), userId, motivo, vetar === '1' || vetar === 'true');
    }
    async crear(req, dto, clientId) {
        return this.perfiles.crear(await this.contextoParaEscribir(req, clientId), entrada(dto));
    }
    async editar(req, id, dto, clientId) {
        return this.perfiles.actualizar(await this.contextoParaEscribir(req, clientId), id, entrada(dto));
    }
    async borrar(req, id, reasignarA, clientId) {
        return this.perfiles.borrar(await this.contextoParaEscribir(req, clientId), id, reasignarA || undefined);
    }
};
exports.PerfilesController = PerfilesController;
PerfilesController.ADMINISTRAN = [user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.DEV, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR];
__decorate([
    (0, common_1.Get)(),
    (0, requiere_area_decorator_1.RequiereArea)('users.equipo', 'ver'),
    (0, roles_decorator_1.Roles)(...CARGOS),
    (0, swagger_1.ApiOperation)({ summary: 'Perfiles de la empresa, con cuántas personas usa cada uno' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PerfilesController.prototype, "listar", null);
__decorate([
    (0, common_1.Get)('asignaciones'),
    (0, requiere_area_decorator_1.RequiereArea)('users.equipo', 'ver'),
    (0, roles_decorator_1.Roles)(...CARGOS),
    (0, swagger_1.ApiOperation)({ summary: 'Qué perfil tiene cada persona de la empresa' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PerfilesController.prototype, "asignaciones", null);
__decorate([
    (0, common_1.Get)('que-ve/:userId'),
    (0, requiere_area_decorator_1.RequiereArea)('users.equipo', 'ver'),
    (0, roles_decorator_1.Roles)(...CARGOS),
    (0, swagger_1.ApiOperation)({ summary: 'Qué ve una persona en esta empresa, y por qué' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], PerfilesController.prototype, "queVe", null);
__decorate([
    (0, common_1.Get)('reingresos'),
    (0, requiere_area_decorator_1.RequiereArea)('users.equipo', 'ver'),
    (0, roles_decorator_1.Roles)(...CARGOS),
    (0, swagger_1.ApiOperation)({ summary: 'Quiénes reingresaron al equipo, cuándo y por qué' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PerfilesController.prototype, "reingresos", null);
__decorate([
    (0, common_1.Get)('texto-de-confidencialidad'),
    (0, requiere_area_decorator_1.RequiereArea)('users.equipo', 'ver'),
    (0, roles_decorator_1.Roles)(...CARGOS),
    (0, swagger_1.ApiOperation)({ summary: 'Texto que se acepta al dar acceso a datos de categoría especial' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PerfilesController.prototype, "texto", null);
__decorate([
    (0, common_1.Post)('sugeridos'),
    (0, requiere_area_decorator_1.RequiereArea)('users.perfiles', 'hacer'),
    (0, roles_decorator_1.Roles)(...CARGOS),
    (0, swagger_1.ApiOperation)({ summary: 'Copiar los perfiles sugeridos de los módulos que la empresa tiene encendidos' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PerfilesController.prototype, "sugeridos", null);
__decorate([
    (0, common_1.Get)('invitaciones'),
    (0, requiere_area_decorator_1.RequiereArea)('users.equipo', 'ver'),
    (0, roles_decorator_1.Roles)(...CARGOS),
    (0, swagger_1.ApiOperation)({ summary: 'Invitaciones pendientes de la empresa' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PerfilesController.prototype, "pendientes", null);
__decorate([
    (0, common_1.Post)('invitaciones'),
    (0, requiere_area_decorator_1.RequiereArea)('users.invitar', 'hacer'),
    (0, roles_decorator_1.Roles)(...CARGOS),
    (0, swagger_1.ApiOperation)({ summary: 'Invitar por correo, eligiendo el perfil en el mismo paso' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, perfiles_dto_1.InvitarDto, String]),
    __metadata("design:returntype", Promise)
], PerfilesController.prototype, "invitar", null);
__decorate([
    (0, common_1.Delete)('invitaciones/:id'),
    (0, requiere_area_decorator_1.RequiereArea)('users.invitar', 'hacer'),
    (0, roles_decorator_1.Roles)(...CARGOS),
    (0, swagger_1.ApiOperation)({ summary: 'Cancelar una invitación pendiente' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], PerfilesController.prototype, "cancelar", null);
__decorate([
    (0, common_1.Put)('asignaciones/:userId'),
    (0, requiere_area_decorator_1.RequiereArea)('users.perfiles', 'hacer'),
    (0, roles_decorator_1.Roles)(...CARGOS),
    (0, swagger_1.ApiOperation)({ summary: 'Asignar un perfil a una persona de la empresa' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, perfiles_dto_1.AsignarPerfilDto, String]),
    __metadata("design:returntype", Promise)
], PerfilesController.prototype, "asignar", null);
__decorate([
    (0, common_1.Delete)('equipo/:userId'),
    (0, requiere_area_decorator_1.RequiereArea)('users.invitar', 'hacer'),
    (0, roles_decorator_1.Roles)(...CARGOS),
    (0, requires_recent_auth_decorator_1.RequiresRecentAuth)('quitar a una persona del equipo'),
    (0, swagger_1.ApiOperation)({ summary: 'Retirar (o vetar) a una persona del equipo de esta empresa, con su motivo' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Query)('motivo')),
    __param(3, (0, common_1.Query)('vetar')),
    __param(4, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], PerfilesController.prototype, "quitar", null);
__decorate([
    (0, common_1.Post)(),
    (0, requiere_area_decorator_1.RequiereArea)('users.perfiles', 'hacer'),
    (0, roles_decorator_1.Roles)(...CARGOS),
    (0, swagger_1.ApiOperation)({ summary: 'Crear un perfil' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, perfiles_dto_1.PerfilDto, String]),
    __metadata("design:returntype", Promise)
], PerfilesController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, requiere_area_decorator_1.RequiereArea)('users.perfiles', 'hacer'),
    (0, roles_decorator_1.Roles)(...CARGOS),
    (0, swagger_1.ApiOperation)({ summary: 'Editar un perfil; cambia lo que ven quienes lo usan' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, perfiles_dto_1.PerfilDto, String]),
    __metadata("design:returntype", Promise)
], PerfilesController.prototype, "editar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, requiere_area_decorator_1.RequiereArea)('users.perfiles', 'hacer'),
    (0, roles_decorator_1.Roles)(...CARGOS),
    (0, swagger_1.ApiOperation)({ summary: 'Borrar un perfil; si alguien lo usa hay que decir a quién pasan' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('reasignarA')),
    __param(3, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], PerfilesController.prototype, "borrar", null);
exports.PerfilesController = PerfilesController = PerfilesController_1 = __decorate([
    (0, swagger_1.ApiTags)('Perfiles'),
    (0, common_1.Controller)('perfiles'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('users'),
    __metadata("design:paramtypes", [perfiles_service_1.PerfilesService,
        invitaciones_service_1.InvitacionesService,
        administracion_del_equipo_service_1.AdministracionDelEquipoService,
        account_access_service_1.AccountAccessService])
], PerfilesController);
function entrada(dto) {
    return {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        areas: dto.areas,
        datosProtegidos: (dto.datosProtegidos ?? {}),
        aceptacion: dto.aceptacion,
        confirmaPersonas: dto.confirmaPersonas,
    };
}
