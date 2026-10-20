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
exports.CampanasController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
const requires_permission_decorator_1 = require("../../core/authorization/requires-permission.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const campanas_service_1 = require("./campanas.service");
const shared_1 = require("@espartanos/shared");
const nivel_de_datos_service_1 = require("../../core/client-scope/nivel-de-datos.service");
class ListarCampanasDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['draft', 'sending', 'sent']),
    __metadata("design:type", String)
], ListarCampanasDto.prototype, "estado", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], ListarCampanasDto.prototype, "cupon", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['true', 'false']),
    __metadata("design:type", String)
], ListarCampanasDto.prototype, "conCupon", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ListarCampanasDto.prototype, "clientId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ListarCampanasDto.prototype, "asunto", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['lista', 'administradores']),
    __metadata("design:type", String)
], ListarCampanasDto.prototype, "destino", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ListarCampanasDto.prototype, "desde", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ListarCampanasDto.prototype, "hasta", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListarCampanasDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], ListarCampanasDto.prototype, "pageSize", void 0);
class CrearCampanaDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CrearCampanaDto.prototype, "asunto", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    __metadata("design:type", String)
], CrearCampanaDto.prototype, "cuerpo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CrearCampanaDto.prototype, "clientId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", Object)
], CrearCampanaDto.prototype, "cupon", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['lista', 'administradores']),
    __metadata("design:type", String)
], CrearCampanaDto.prototype, "destino", void 0);
class EditarCampanaDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], EditarCampanaDto.prototype, "asunto", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    __metadata("design:type", String)
], EditarCampanaDto.prototype, "cuerpo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", Object)
], EditarCampanaDto.prototype, "cupon", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['lista', 'administradores']),
    __metadata("design:type", String)
], EditarCampanaDto.prototype, "destino", void 0);
let CampanasController = class CampanasController {
    constructor(campanas, niveles) {
        this.campanas = campanas;
        this.niveles = niveles;
    }
    listar(req, filtros) {
        return this.campanas.listar(req.organizationId || req.user.organizationId, undefined, filtros);
    }
    async destinatarios(req, empresa, destino) {
        const organizationId = req.organizationId || req.user.organizationId;
        const resultado = await this.campanas.destinatarios(organizationId, empresa, destino === 'administradores' ? 'administradores' : 'lista');
        const niveles = await this.niveles.nivelesDe(organizationId, req.user.id, 'marketing');
        const nivel = niveles.de(empresa && empresa !== 'agencia' ? empresa : null);
        return { ...resultado, muestra: (0, shared_1.recortarListaProtegidos)(resultado.muestra, 'marketing', nivel).datos };
    }
    vistaPrevia(dto) {
        return this.campanas.vistaPrevia(dto.asunto ?? '', dto.cuerpo ?? '');
    }
    crear(req, dto) {
        return this.campanas.crear({
            organizationId: req.organizationId || req.user.organizationId,
            clientId: dto.clientId,
            asunto: dto.asunto,
            cuerpo: dto.cuerpo,
            cupon: dto.cupon,
            destino: dto.destino,
            createdBy: req.user.id,
        });
    }
    editar(req, id, dto) {
        return this.campanas.editar(id, req.organizationId || req.user.organizationId, dto);
    }
    async borrar(req, id) {
        await this.campanas.borrar(id, req.organizationId || req.user.organizationId);
        return { borrada: true };
    }
    enviar(req, id) {
        return this.campanas.enviar(id, req.organizationId || req.user.organizationId);
    }
    avance(req, id) {
        return this.campanas.avance(id, req.organizationId || req.user.organizationId);
    }
    async fallidos(req, id) {
        const organizationId = req.organizationId || req.user.organizationId;
        const { clientId, ...resultado } = await this.campanas.fallidos(id, organizationId);
        const niveles = await this.niveles.nivelesDe(organizationId, req.user.id, 'marketing');
        return { ...resultado, fallidos: (0, shared_1.recortarListaProtegidos)(resultado.fallidos, 'marketing', niveles.de(clientId)).datos };
    }
    retorno(req, id) {
        return this.campanas.retorno(id, req.organizationId || req.user.organizationId);
    }
};
exports.CampanasController = CampanasController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Campañas escritas, enviadas y en borrador' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ListarCampanasDto]),
    __metadata("design:returntype", void 0)
], CampanasController.prototype, "listar", null);
__decorate([
    (0, common_1.Get)('destinatarios'),
    (0, swagger_1.ApiOperation)({ summary: 'A cuántos llegaría la campaña si se enviara ahora' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('empresa')),
    __param(2, (0, common_1.Query)('destino')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], CampanasController.prototype, "destinatarios", null);
__decorate([
    (0, common_1.Post)('vista-previa'),
    (0, swagger_1.ApiOperation)({ summary: 'Ver cómo queda la campaña, sin enviarla' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [EditarCampanaDto]),
    __metadata("design:returntype", void 0)
], CampanasController.prototype, "vistaPrevia", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Escribir una campaña, en borrador' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CrearCampanaDto]),
    __metadata("design:returntype", void 0)
], CampanasController.prototype, "crear", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Corregir una campaña que todavía no se ha enviado' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, EditarCampanaDto]),
    __metadata("design:returntype", void 0)
], CampanasController.prototype, "editar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Descartar un borrador' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CampanasController.prototype, "borrar", null);
__decorate([
    (0, common_1.Post)(':id/enviar'),
    (0, requires_permission_decorator_1.RequiresPermission)('marketing', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Poner la campaña en cola para salir' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CampanasController.prototype, "enviar", null);
__decorate([
    (0, common_1.Get)(':id/avance'),
    (0, swagger_1.ApiOperation)({ summary: 'Avance del envío de una campaña' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CampanasController.prototype, "avance", null);
__decorate([
    (0, common_1.Get)(':id/fallidos'),
    (0, swagger_1.ApiOperation)({ summary: 'Destinatarios a los que no les llegó, con el motivo' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CampanasController.prototype, "fallidos", null);
__decorate([
    (0, common_1.Get)(':id/retorno'),
    (0, swagger_1.ApiOperation)({ summary: 'Canjes del cupón de la campaña desde su envío' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CampanasController.prototype, "retorno", null);
exports.CampanasController = CampanasController = __decorate([
    (0, swagger_1.ApiTags)('marketing'),
    (0, common_1.Controller)('marketing/campanas'),
    (0, module_scope_decorator_1.ModuleScope)('marketing'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.DEV),
    __metadata("design:paramtypes", [campanas_service_1.CampanasService,
        nivel_de_datos_service_1.NivelDeDatosService])
], CampanasController);
