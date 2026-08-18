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
exports.ProcessTemplatesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const update_process_template_dto_1 = require("./dto/update-process-template.dto");
const process_templates_service_1 = require("./process-templates.service");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
let ProcessTemplatesController = class ProcessTemplatesController {
    constructor(workflows) {
        this.workflows = workflows;
    }
    list(req) { return this.workflows.list(req.organizationId); }
    update(id, dto, req) { return this.workflows.update(id, req.organizationId, dto); }
    reset(code, req) { return this.workflows.reset(code, req.organizationId); }
};
exports.ProcessTemplatesController = ProcessTemplatesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar flujos operativos configurables' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProcessTemplatesController.prototype, "list", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar etapas, SLA y responsables de un flujo' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_process_template_dto_1.UpdateProcessTemplateDto, Object]),
    __metadata("design:returntype", void 0)
], ProcessTemplatesController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':code/reset'),
    (0, swagger_1.ApiOperation)({ summary: 'Restaurar un flujo desde el Documento Maestro' }),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProcessTemplatesController.prototype, "reset", null);
exports.ProcessTemplatesController = ProcessTemplatesController = __decorate([
    (0, swagger_1.ApiTags)('Flujos configurables'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('process-templates'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, module_scope_decorator_1.ModuleScope)('operations'),
    __metadata("design:paramtypes", [process_templates_service_1.ProcessTemplatesService])
], ProcessTemplatesController);
