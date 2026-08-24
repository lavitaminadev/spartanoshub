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
exports.ClientsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const create_client_use_case_1 = require("./create-client.use-case");
const list_clients_use_case_1 = require("./list-clients.use-case");
const get_client_use_case_1 = require("./get-client.use-case");
const client_entity_1 = require("./client.entity");
const create_client_dto_1 = require("./dto/create-client.dto");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const update_client_dto_1 = require("./dto/update-client.dto");
const user_entity_1 = require("../users/user.entity");
const account_access_service_1 = require("../../core/client-scope/account-access.service");
const client_overview_service_1 = require("./client-overview.service");
const pagination_dto_1 = require("../../shared/dto/pagination.dto");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
const requires_recent_auth_decorator_1 = require("../../core/auth/requires-recent-auth.decorator");
let ClientsController = class ClientsController {
    constructor(repo, users, accountAccess, overviewService, createClient, listClients, getClient) {
        this.repo = repo;
        this.users = users;
        this.accountAccess = accountAccess;
        this.overviewService = overviewService;
        this.createClient = createClient;
        this.listClients = listClients;
        this.getClient = getClient;
    }
    create(dto, req) {
        return this.createClient.execute({ ...dto, organizationId: req.organizationId });
    }
    async list(pagination, req) {
        const clientIds = req.user.role === user_role_enum_1.UserRole.CLIENT
            ? (req.user.clientId ? [req.user.clientId] : [])
            : await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.listClients.execute(req.organizationId, clientIds, pagination.limit, pagination.offset);
    }
    managerOptions(req) {
        return this.users.find({
            select: { id: true, name: true, role: true },
            where: {
                organizationId: req.organizationId,
                isActive: true,
                role: (0, typeorm_2.In)([user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR]),
            },
            order: { name: 'ASC' },
        });
    }
    async overview(id, req) {
        await this.accountAccess.assertClient(req.organizationId, req.user, id);
        return this.overviewService.getOverview(id, req.organizationId);
    }
    async getOne(id, req) {
        await this.accountAccess.assertClient(req.organizationId, req.user, id);
        return this.getClient.execute(id, req.organizationId);
    }
    async update(id, dto, req) {
        const client = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!client)
            throw new common_1.NotFoundException('Client not found');
        if (dto.communityManagerId) {
            const manager = await this.users.findOne({ where: { id: dto.communityManagerId, organizationId: req.organizationId, isActive: true } });
            if (!manager || !['community_manager', 'operations_director'].includes(manager.role)) {
                throw new common_1.BadRequestException('El responsable debe ser una CM o dirección de operaciones activa');
            }
        }
        Object.assign(client, dto, {
            startedAt: dto.startedAt ? new Date(dto.startedAt) : client.startedAt,
            renewalAt: dto.renewalAt ? new Date(dto.renewalAt) : client.renewalAt,
        });
        return this.repo.save(client);
    }
    async remove(id, req) {
        const client = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!client)
            throw new common_1.NotFoundException('Client not found');
        try {
            return await this.repo.remove(client);
        }
        catch {
            throw new common_1.BadRequestException('La empresa tiene datos asociados. Desactívala para conservar CRM, reservas y trazabilidad.');
        }
    }
};
exports.ClientsController = ClientsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Crear un nuevo cliente' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_client_dto_1.CreateClientDto, Object]),
    __metadata("design:returntype", void 0)
], ClientsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar clientes de la organizacion' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationDto, Object]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('options/managers'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Listar responsables disponibles para cuentas' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClientsController.prototype, "managerOptions", null);
__decorate([
    (0, common_1.Get)(':id/overview'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener vista operativa 360 de un cliente' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener detalle de un cliente' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "getOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar un cliente' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_client_dto_1.UpdateClientDto, Object]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, requires_recent_auth_decorator_1.RequiresRecentAuth)('eliminar una empresa'),
    (0, swagger_1.ApiOperation)({ summary: 'Eliminar un cliente' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ClientsController.prototype, "remove", null);
exports.ClientsController = ClientsController = __decorate([
    (0, swagger_1.ApiTags)('Clientes'),
    (0, common_1.Controller)('clients'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    (0, module_scope_decorator_1.ModuleScope)('clients'),
    __param(0, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        account_access_service_1.AccountAccessService,
        client_overview_service_1.ClientOverviewService,
        create_client_use_case_1.CreateClientUseCase,
        list_clients_use_case_1.ListClientsUseCase,
        get_client_use_case_1.GetClientUseCase])
], ClientsController);
