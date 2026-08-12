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
exports.ContactsController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const contacts_service_1 = require("./contacts.service");
const update_contact_dto_1 = require("./dto/update-contact.dto");
const pagination_dto_1 = require("../../../shared/dto/pagination.dto");
const roles_decorator_1 = require("../../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../../organizations/user-role.enum");
const account_access_service_1 = require("../../../core/client-scope/account-access.service");
const module_scope_decorator_1 = require("../../../core/authorization/module-scope.decorator");
let ContactsController = class ContactsController {
    constructor(service, accountAccess) {
        this.service = service;
        this.accountAccess = accountAccess;
    }
    async findAll(query, clientId, req) {
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.service.findAll(req.organizationId, query.limit, query.offset, clientId, allowed);
    }
    async segments(clientId, req) {
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.service.segments(req.organizationId, clientId, allowed);
    }
    async findOne(id, req) {
        const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.service.findOne(id, req.organizationId, allowed);
    }
    async update(id, dto, req) {
        const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.service.update(id, dto, req.organizationId, allowed);
    }
};
exports.ContactsController = ContactsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Query)('clientId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('segments'),
    __param(0, (0, common_1.Query)('clientId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "segments", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_contact_dto_1.UpdateContactDto, Object]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "update", null);
exports.ContactsController = ContactsController = __decorate([
    (0, common_1.Controller)('crm/contacts'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, module_scope_decorator_1.ModuleScope)('crm'),
    __metadata("design:paramtypes", [contacts_service_1.ContactsService,
        account_access_service_1.AccountAccessService])
], ContactsController);
