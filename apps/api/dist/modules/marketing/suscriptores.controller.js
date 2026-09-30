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
exports.SuscriptoresController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const client_capability_service_1 = require("../../core/client-scope/client-capability.service");
const public_decorator_1 = require("../../core/auth/decorators/public.decorator");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const suscriptores_service_1 = require("./suscriptores.service");
const suscriptor_entity_1 = require("./suscriptor.entity");
const pagina_de_baja_1 = require("./pagina-de-baja");
class ImportarSuscriptoresDto {
}
let SuscriptoresController = class SuscriptoresController {
    constructor(suscriptores, capacidades) {
        this.suscriptores = suscriptores;
        this.capacidades = capacidades;
    }
    async encierroDe(req) {
        if (req.user.role !== user_role_enum_1.UserRole.CLIENT)
            return undefined;
        if (!req.user.clientId)
            throw new common_1.ForbiddenException('La cuenta de empresa no tiene una empresa asociada');
        await this.capacidades.assert(req.organizationId || req.user.organizationId, req.user.clientId, 'marketing');
        return req.user.clientId;
    }
    async listar(req, limit, empresa, estado, origen, busqueda) {
        return this.suscriptores.listar(req.organizationId || req.user.organizationId, {
            limite: limit ? Number(limit) : undefined,
            empresa,
            encerradoEn: await this.encierroDe(req),
            estado: Object.values(suscriptor_entity_1.EstadoDeSuscripcion).includes(estado) ? estado : undefined,
            origen,
            busqueda,
        });
    }
    async descargar(req, empresa) {
        const organizationId = req.organizationId || req.user.organizationId;
        const alcance = (await this.encierroDe(req)) || empresa || 'agencia';
        const filas = await this.suscriptores.paraDescargar(organizationId, alcance);
        return {
            empresa: alcance,
            total: filas.length,
            data: filas.map((fila) => ({
                email: fila.email,
                nombre: fila.name,
                aceptoEl: fila.consentAt,
                origen: fila.source,
                detalle: fila.sourceDetail,
            })),
        };
    }
    importar(req, dto) {
        return this.suscriptores.importarCsv(req.organizationId || req.user.organizationId, dto.contenido, dto.origen, dto.detalle, dto.textoConsentimiento, dto.clientId ?? null);
    }
    async baja(token, alcance, origen, res) {
        const todas = alcance === 'todas';
        const resultado = await this.suscriptores
            .darDeBaja(token, todas ? 'todas' : 'local', origen)
            .catch(() => null);
        res.type('html').send((0, pagina_de_baja_1.paginaDeBaja)(resultado, token, origen));
    }
};
exports.SuscriptoresController = SuscriptoresController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.DEV, user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Lista de suscriptores con su procedencia y estado' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('empresa')),
    __param(3, (0, common_1.Query)('estado')),
    __param(4, (0, common_1.Query)('origen')),
    __param(5, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], SuscriptoresController.prototype, "listar", null);
__decorate([
    (0, common_1.Get)('descargar'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.DEV, user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Descargar los suscritos de una empresa' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('empresa')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SuscriptoresController.prototype, "descargar", null);
__decorate([
    (0, common_1.Post)('importar'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.DEV),
    (0, swagger_1.ApiOperation)({ summary: 'Importar una lista de correos declarando su origen' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ImportarSuscriptoresDto]),
    __metadata("design:returntype", void 0)
], SuscriptoresController.prototype, "importar", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 20, ttl: 60000 } }),
    (0, common_1.Get)('baja/:token'),
    (0, swagger_1.ApiOperation)({ summary: 'Darse de baja de la lista de correo' }),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Query)('alcance')),
    __param(2, (0, common_1.Query)('origen')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SuscriptoresController.prototype, "baja", null);
exports.SuscriptoresController = SuscriptoresController = __decorate([
    (0, swagger_1.ApiTags)('marketing'),
    (0, common_1.Controller)('marketing/suscriptores'),
    (0, module_scope_decorator_1.ModuleScope)('marketing'),
    __metadata("design:paramtypes", [suscriptores_service_1.SuscriptoresService,
        client_capability_service_1.ClientCapabilityService])
], SuscriptoresController);
