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
exports.DestinatariosDeAvisosController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../authorization/roles.decorator");
const module_scope_decorator_1 = require("../authorization/module-scope.decorator");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const account_access_service_1 = require("../client-scope/account-access.service");
const destinatarios_de_avisos_service_1 = require("./destinatarios-de-avisos.service");
const destinatario_de_avisos_entity_1 = require("./destinatario-de-avisos.entity");
class GuardarDestinatarioDto {
}
__decorate([
    (0, class_validator_1.IsEmail)({}, { message: 'La dirección de correo no es válida' }),
    __metadata("design:type", String)
], GuardarDestinatarioDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GuardarDestinatarioDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], GuardarDestinatarioDto.prototype, "cargo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.IsIn)(destinatario_de_avisos_entity_1.TIPOS_DE_AVISO_VALIDOS, { each: true }),
    __metadata("design:type", Array)
], GuardarDestinatarioDto.prototype, "tipos", void 0);
let DestinatariosDeAvisosController = class DestinatariosDeAvisosController {
    constructor(destinatarios, acceso) {
        this.destinatarios = destinatarios;
        this.acceso = acceso;
    }
    async empresaDe(req, pedida) {
        const organizationId = req.organizationId || req.user.organizationId;
        if (req.user.role === user_role_enum_1.UserRole.CLIENT) {
            if (!req.user.clientId)
                throw new common_1.ForbiddenException('La cuenta de empresa no tiene una empresa asociada');
            return req.user.clientId;
        }
        if (!pedida)
            throw new common_1.ForbiddenException('Falta indicar de qué empresa es el equipo');
        const alcanzables = await this.acceso.allowedClientIds(organizationId, req.user);
        if (alcanzables && !alcanzables.includes(pedida)) {
            throw new common_1.ForbiddenException('Esta cuenta no alcanza esa empresa');
        }
        return pedida;
    }
    tipos() {
        return {
            data: destinatario_de_avisos_entity_1.TIPOS_DE_AVISO_VALIDOS.map((clave) => ({ clave, etiqueta: destinatario_de_avisos_entity_1.TIPOS_DE_AVISO[clave].etiqueta })),
        };
    }
    async listar(req, empresa) {
        const clientId = await this.empresaDe(req, empresa);
        const data = await this.destinatarios.listar(req.organizationId || req.user.organizationId, clientId);
        return { data };
    }
    async guardar(req, dto, empresa) {
        const clientId = await this.empresaDe(req, empresa);
        return this.destinatarios.guardar(req.organizationId || req.user.organizationId, clientId, dto, req.user.id);
    }
    async borrar(req, id, empresa) {
        const clientId = await this.empresaDe(req, empresa);
        await this.destinatarios.borrar(req.organizationId || req.user.organizationId, clientId, id);
        return { borrada: true };
    }
};
exports.DestinatariosDeAvisosController = DestinatariosDeAvisosController;
__decorate([
    (0, common_1.Get)('tipos'),
    (0, swagger_1.ApiOperation)({ summary: 'Tipos de aviso que puede recibir el equipo' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DestinatariosDeAvisosController.prototype, "tipos", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Casillas del equipo de un local' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('empresa')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DestinatariosDeAvisosController.prototype, "listar", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Anotar o corregir una casilla del equipo' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('empresa')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GuardarDestinatarioDto, String]),
    __metadata("design:returntype", Promise)
], DestinatariosDeAvisosController.prototype, "guardar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Quitar una casilla del equipo' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('empresa')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], DestinatariosDeAvisosController.prototype, "borrar", null);
exports.DestinatariosDeAvisosController = DestinatariosDeAvisosController = __decorate([
    (0, swagger_1.ApiTags)('notifications'),
    (0, common_1.Controller)('avisos/destinatarios'),
    (0, module_scope_decorator_1.ModuleScope)('reservations'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.DEV, user_role_enum_1.UserRole.CLIENT),
    __metadata("design:paramtypes", [destinatarios_de_avisos_service_1.DestinatariosDeAvisosService,
        account_access_service_1.AccountAccessService])
], DestinatariosDeAvisosController);
