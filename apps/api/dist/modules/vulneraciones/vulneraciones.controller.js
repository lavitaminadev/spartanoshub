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
exports.VulneracionesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const vulneracion_dto_1 = require("./dto/vulneracion.dto");
const vulneraciones_service_1 = require("./vulneraciones.service");
let VulneracionesController = class VulneracionesController {
    constructor(service) {
        this.service = service;
    }
    listar(req) {
        return this.service.listar(req.organizationId);
    }
    crear(req, dto) {
        return this.service.crear(req.organizationId, req.user.id, dto);
    }
    actualizar(req, id, dto) {
        return this.service.actualizar(req.organizationId, id, dto);
    }
};
exports.VulneracionesController = VulneracionesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VulneracionesController.prototype, "listar", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, vulneracion_dto_1.CrearVulneracionDto]),
    __metadata("design:returntype", void 0)
], VulneracionesController.prototype, "crear", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, vulneracion_dto_1.ActualizarVulneracionDto]),
    __metadata("design:returntype", void 0)
], VulneracionesController.prototype, "actualizar", null);
exports.VulneracionesController = VulneracionesController = __decorate([
    (0, swagger_1.ApiTags)('Vulneraciones'),
    (0, common_1.Controller)('vulneraciones'),
    (0, module_scope_decorator_1.ModuleScope)('settings'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.DEV),
    __metadata("design:paramtypes", [vulneraciones_service_1.VulneracionesService])
], VulneracionesController);
