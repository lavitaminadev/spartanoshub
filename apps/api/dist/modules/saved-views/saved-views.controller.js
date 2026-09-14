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
exports.SavedViewsController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
const saved_views_service_1 = require("./saved-views.service");
class GuardarVistaDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], GuardarVistaDto.prototype, "scope", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], GuardarVistaDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], GuardarVistaDto.prototype, "filters", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GuardarVistaDto.prototype, "shared", void 0);
class CompartirVistaDto {
}
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CompartirVistaDto.prototype, "shared", void 0);
let SavedViewsController = class SavedViewsController {
    constructor(vistas) {
        this.vistas = vistas;
    }
    listar(req, scope) {
        return this.vistas.listar(req.user, scope);
    }
    guardar(req, dto) {
        return this.vistas.guardar(req.user, dto);
    }
    compartir(req, id, dto) {
        return this.vistas.compartir(req.user, id, dto.shared);
    }
    borrar(req, id) {
        return this.vistas.borrar(req.user, id);
    }
};
exports.SavedViewsController = SavedViewsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('scope')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SavedViewsController.prototype, "listar", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GuardarVistaDto]),
    __metadata("design:returntype", void 0)
], SavedViewsController.prototype, "guardar", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CompartirVistaDto]),
    __metadata("design:returntype", void 0)
], SavedViewsController.prototype, "compartir", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SavedViewsController.prototype, "borrar", null);
exports.SavedViewsController = SavedViewsController = __decorate([
    (0, swagger_1.ApiTags)('Vistas guardadas'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Controller)('saved-views'),
    (0, module_scope_decorator_1.ModuleExempt)('Filtros con nombre de las listas; aplicarlos vuelve a pedir los datos con los permisos de cada módulo'),
    __metadata("design:paramtypes", [saved_views_service_1.SavedViewsService])
], SavedViewsController);
