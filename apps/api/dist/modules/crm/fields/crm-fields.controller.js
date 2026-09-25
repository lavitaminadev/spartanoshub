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
exports.CrmFieldsController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const shared_1 = require("@espartanos/shared");
const module_scope_decorator_1 = require("../../../core/authorization/module-scope.decorator");
const requires_permission_decorator_1 = require("../../../core/authorization/requires-permission.decorator");
const roles_decorator_1 = require("../../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../../organizations/user-role.enum");
const crm_fields_service_1 = require("./crm-fields.service");
const TIPOS = shared_1.TIPOS_DE_CAMPO.map((tipo) => tipo.value);
class CrearCampoDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CrearCampoDto.prototype, "clientId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['lead', 'contact', 'opportunity']),
    __metadata("design:type", String)
], CrearCampoDto.prototype, "entity", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CrearCampoDto.prototype, "label", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], CrearCampoDto.prototype, "key", void 0);
__decorate([
    (0, class_validator_1.IsIn)(TIPOS),
    __metadata("design:type", String)
], CrearCampoDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CrearCampoDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CrearCampoDto.prototype, "required", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(120, { each: true }),
    __metadata("design:type", Array)
], CrearCampoDto.prototype, "metaQuestions", void 0);
class EditarCampoDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(120, { each: true }),
    __metadata("design:type", Array)
], EditarCampoDto.prototype, "metaQuestions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], EditarCampoDto.prototype, "label", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EditarCampoDto.prototype, "required", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], EditarCampoDto.prototype, "position", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], EditarCampoDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(TIPOS),
    __metadata("design:type", String)
], EditarCampoDto.prototype, "type", void 0);
class ArchivarCampoDto {
}
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ArchivarCampoDto.prototype, "archivado", void 0);
const QUIEN_DEFINE = [user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR];
let CrmFieldsController = class CrmFieldsController {
    constructor(campos) {
        this.campos = campos;
    }
    listar(req, entity, archivados, clientId) {
        return this.campos.listar(req.organizationId, entity, archivados === 'true', clientId || undefined);
    }
    crear(req, dto) {
        return this.campos.crear(req.organizationId, req.user.id, dto);
    }
    editar(req, id, dto) {
        return this.campos.actualizar(req.organizationId, id, dto);
    }
    archivar(req, id, dto) {
        return this.campos.archivar(req.organizationId, id, dto.archivado);
    }
};
exports.CrmFieldsController = CrmFieldsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Campos propios de un tipo de registro' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('entity')),
    __param(2, (0, common_1.Query)('archivados')),
    __param(3, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], CrmFieldsController.prototype, "listar", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(...QUIEN_DEFINE),
    (0, requires_permission_decorator_1.RequiresPermission)('crm', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Crear un campo propio' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CrearCampoDto]),
    __metadata("design:returntype", void 0)
], CrmFieldsController.prototype, "crear", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(...QUIEN_DEFINE),
    (0, requires_permission_decorator_1.RequiresPermission)('crm', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Cambiar nombre, orden, opciones o tipo de un campo' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, EditarCampoDto]),
    __metadata("design:returntype", void 0)
], CrmFieldsController.prototype, "editar", null);
__decorate([
    (0, common_1.Patch)(':id/archivo'),
    (0, roles_decorator_1.Roles)(...QUIEN_DEFINE),
    (0, requires_permission_decorator_1.RequiresPermission)('crm', 'manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Archivar o desarchivar un campo, sin borrar lo guardado' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ArchivarCampoDto]),
    __metadata("design:returntype", void 0)
], CrmFieldsController.prototype, "archivar", null);
exports.CrmFieldsController = CrmFieldsController = __decorate([
    (0, swagger_1.ApiTags)('CRM · Campos propios'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Controller)('crm/fields'),
    (0, module_scope_decorator_1.ModuleScope)('crm'),
    __metadata("design:paramtypes", [crm_fields_service_1.CrmFieldsService])
], CrmFieldsController);
