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
exports.PodsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const pod_dto_1 = require("./dto/pod.dto");
const pods_service_1 = require("./pods.service");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
let PodsController = class PodsController {
    constructor(pods) {
        this.pods = pods;
    }
    list(req) { return this.pods.list(req.organizationId); }
    create(dto, req) { return this.pods.create(req.organizationId, dto); }
    update(id, dto, req) { return this.pods.update(id, req.organizationId, dto); }
    setMembers(id, dto, req) { return this.pods.setMembers(id, req.organizationId, dto.userIds); }
    setClients(id, dto, req) { return this.pods.setClients(id, req.organizationId, dto.clientIds); }
    remove(id, req) { return this.pods.remove(id, req.organizationId); }
};
exports.PodsController = PodsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar pods, integrantes y cuentas' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PodsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Crear pod' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pod_dto_1.CreatePodDto, Object]),
    __metadata("design:returntype", void 0)
], PodsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pod_dto_1.UpdatePodDto, Object]),
    __metadata("design:returntype", void 0)
], PodsController.prototype, "update", null);
__decorate([
    (0, common_1.Put)(':id/members'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pod_dto_1.SetPodMembersDto, Object]),
    __metadata("design:returntype", void 0)
], PodsController.prototype, "setMembers", null);
__decorate([
    (0, common_1.Put)(':id/clients'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pod_dto_1.SetPodClientsDto, Object]),
    __metadata("design:returntype", void 0)
], PodsController.prototype, "setClients", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PodsController.prototype, "remove", null);
exports.PodsController = PodsController = __decorate([
    (0, swagger_1.ApiTags)('Pods'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('pods'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, module_scope_decorator_1.ModuleScope)('users'),
    __metadata("design:paramtypes", [pods_service_1.PodsService])
], PodsController);
