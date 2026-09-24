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
exports.ReglasController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const reglas_service_1 = require("./reglas.service");
const module_scope_decorator_1 = require("../../../core/authorization/module-scope.decorator");
const requires_permission_decorator_1 = require("../../../core/authorization/requires-permission.decorator");
class CondicionDto {
}
__decorate([
    (0, class_validator_1.IsIn)(['respuestas', 'pregunta', 'campo', 'fuente', 'responsable', 'monto', 'campana']),
    __metadata("design:type", String)
], CondicionDto.prototype, "donde", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CondicionDto.prototype, "clave", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['contiene', 'no_contiene', 'es', 'no_es', 'vacio', 'no_vacio', 'mayor_que', 'menor_que']),
    __metadata("design:type", String)
], CondicionDto.prototype, "comparador", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], CondicionDto.prototype, "valor", void 0);
class TareaDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], TareaDto.prototype, "titulo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], TareaDto.prototype, "enHoras", void 0);
class AccionesDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['green', 'yellow', 'red']),
    __metadata("design:type", String)
], AccionesDto.prototype, "semaforo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], AccionesDto.prototype, "calificacion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], AccionesDto.prototype, "etapa", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AccionesDto.prototype, "responsable", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AccionesDto.prototype, "descartarMotivo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => TareaDto),
    __metadata("design:type", TareaDto)
], AccionesDto.prototype, "tarea", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AccionesDto.prototype, "avisarA", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AccionesDto.prototype, "nota", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], AccionesDto.prototype, "guardarEnCampo", void 0);
class GuardarReglaDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GuardarReglaDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['todas', 'alguna']),
    __metadata("design:type", String)
], GuardarReglaDto.prototype, "unir", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(10),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CondicionDto),
    __metadata("design:type", Array)
], GuardarReglaDto.prototype, "condiciones", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AccionesDto),
    __metadata("design:type", AccionesDto)
], GuardarReglaDto.prototype, "acciones", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GuardarReglaDto.prototype, "activa", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GuardarReglaDto.prototype, "automatica", void 0);
class OrdenDto {
}
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(60),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], OrdenDto.prototype, "ids", void 0);
class CopiarDto {
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CopiarDto.prototype, "desdeClientId", void 0);
class AplicarDto {
}
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], AplicarDto.prototype, "leadIds", void 0);
let ReglasController = class ReglasController {
    constructor(reglas) {
        this.reglas = reglas;
    }
    listar(req, clientId, archivadas) {
        return this.reglas.listar(req.organizationId, this.empresa(req, clientId), archivadas === 'true');
    }
    preguntas(req, clientId) {
        return this.reglas.preguntasQueLlegan(req.organizationId, this.empresa(req, clientId));
    }
    probar(req, clientId, dto) {
        return this.reglas.cuantosCalzan(req.organizationId, this.empresa(req, clientId), dto);
    }
    crear(req, clientId, dto) {
        return this.reglas.crear(req.organizationId, this.empresa(req, clientId), dto, req.user.id);
    }
    reordenar(req, clientId, dto) {
        return this.reglas.reordenar(req.organizationId, this.empresa(req, clientId), dto.ids);
    }
    async copiar(req, clientId, dto) {
        const copiadas = await this.reglas.copiarDesde(req.organizationId, dto.desdeClientId, this.empresa(req, clientId), req.user.id);
        return { copiadas };
    }
    editar(req, id, dto) {
        return this.reglas.editar(req.organizationId, id, dto);
    }
    activar(req, id, dto) {
        return this.reglas.activar(req.organizationId, id, dto?.activa === true);
    }
    automatizar(req, id, dto) {
        return this.reglas.automatizar(req.organizationId, id, dto?.automatica === true);
    }
    archivar(req, id) {
        return this.reglas.archivar(req.organizationId, id, true);
    }
    restaurar(req, id) {
        return this.reglas.archivar(req.organizationId, id, false);
    }
    empresa(req, pedido) {
        if (req.user.role === 'client')
            return req.user.clientId ?? '';
        return pedido ?? '';
    }
};
exports.ReglasController = ReglasController;
__decorate([
    (0, common_1.Get)(),
    (0, requires_permission_decorator_1.RequiresPermission)('crm', 'view'),
    (0, swagger_1.ApiOperation)({ summary: 'Reglas de una empresa, en orden' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __param(2, (0, common_1.Query)('archivadas')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ReglasController.prototype, "listar", null);
__decorate([
    (0, common_1.Get)('preguntas'),
    (0, requires_permission_decorator_1.RequiresPermission)('crm', 'view'),
    (0, swagger_1.ApiOperation)({ summary: 'Preguntas que están llegando, con sus respuestas y cuántos las contestan' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReglasController.prototype, "preguntas", null);
__decorate([
    (0, common_1.Post)('probar'),
    (0, requires_permission_decorator_1.RequiresPermission)('crm', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Cuántos leads calzarían con una regla, sin tocarlos' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, GuardarReglaDto]),
    __metadata("design:returntype", void 0)
], ReglasController.prototype, "probar", null);
__decorate([
    (0, common_1.Post)(),
    (0, requires_permission_decorator_1.RequiresPermission)('crm', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Crear una regla' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, GuardarReglaDto]),
    __metadata("design:returntype", void 0)
], ReglasController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)('orden'),
    (0, requires_permission_decorator_1.RequiresPermission)('crm', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Reordenar: manda la primera que calza' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, OrdenDto]),
    __metadata("design:returntype", void 0)
], ReglasController.prototype, "reordenar", null);
__decorate([
    (0, common_1.Post)('copiar'),
    (0, requires_permission_decorator_1.RequiresPermission)('crm', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Copiar las reglas de otra empresa, apagadas' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CopiarDto]),
    __metadata("design:returntype", Promise)
], ReglasController.prototype, "copiar", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, requires_permission_decorator_1.RequiresPermission)('crm', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Editar una regla' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, GuardarReglaDto]),
    __metadata("design:returntype", void 0)
], ReglasController.prototype, "editar", null);
__decorate([
    (0, common_1.Put)(':id/activa'),
    (0, requires_permission_decorator_1.RequiresPermission)('crm', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Encender o apagar' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ReglasController.prototype, "activar", null);
__decorate([
    (0, common_1.Put)(':id/automatica'),
    (0, requires_permission_decorator_1.RequiresPermission)('crm', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Que corra sola al entrar un lead, o solo a mano' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ReglasController.prototype, "automatizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, requires_permission_decorator_1.RequiresPermission)('crm', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Archivar una regla' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReglasController.prototype, "archivar", null);
__decorate([
    (0, common_1.Put)(':id/restaurar'),
    (0, requires_permission_decorator_1.RequiresPermission)('crm', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Sacar del archivo' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReglasController.prototype, "restaurar", null);
exports.ReglasController = ReglasController = __decorate([
    (0, swagger_1.ApiTags)('CRM · Reglas de calificación'),
    (0, common_1.Controller)('crm/reglas'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('crm'),
    __metadata("design:paramtypes", [reglas_service_1.ReglasService])
], ReglasController);
