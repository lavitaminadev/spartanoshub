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
exports.ContentController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const create_content_grid_use_case_1 = require("./create-content-grid.use-case");
const list_content_grids_use_case_1 = require("./list-content-grids.use-case");
const create_grid_dto_1 = require("./dto/create-grid.dto");
const content_item_entity_1 = require("./content-item.entity");
const content_grid_entity_1 = require("./content-grid.entity");
const add_content_item_dto_1 = require("./dto/add-content-item.dto");
const update_item_dto_1 = require("./dto/update-item.dto");
const update_grid_status_dto_1 = require("./dto/update-grid-status.dto");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const account_access_service_1 = require("../../core/client-scope/account-access.service");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
let ContentController = class ContentController {
    constructor(createGrid, listGrids, itemRepo, gridRepo, accountAccess) {
        this.createGrid = createGrid;
        this.listGrids = listGrids;
        this.itemRepo = itemRepo;
        this.gridRepo = gridRepo;
        this.accountAccess = accountAccess;
    }
    async create(dto, req) {
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
        return this.createGrid.execute({
            ...dto,
            organizationId: req.organizationId,
            weekStart: new Date(dto.weekStart),
            weekEnd: new Date(dto.weekEnd),
        });
    }
    async list(clientId, month, req) {
        const effectiveClientId = req.user?.role === user_role_enum_1.UserRole.CLIENT ? req.user.clientId : clientId;
        if (req.user?.role === user_role_enum_1.UserRole.CLIENT && !effectiveClientId)
            throw new common_1.ForbiddenException('Client account is not associated');
        await this.accountAccess.assertClient(req.organizationId, req.user, effectiveClientId);
        const clientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.listGrids.execute(req.organizationId, effectiveClientId, month, req.user?.role === user_role_enum_1.UserRole.CLIENT, clientIds);
    }
    async addItem(gridId, dto, req) {
        const grid = await this.gridRepo.findOne({ where: { id: gridId, organizationId: req.organizationId } });
        if (!grid)
            throw new common_1.NotFoundException('Content grid not found');
        await this.accountAccess.assertClient(req.organizationId, req.user, grid.clientId);
        const item = this.itemRepo.create({
            ...dto,
            caption: dto.caption.trim(),
            contentGridId: grid.id,
            scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        });
        return this.itemRepo.save(item);
    }
    async updateGridStatus(id, dto, req) {
        const grid = await this.gridRepo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!grid)
            throw new common_1.NotFoundException('Content grid not found');
        await this.accountAccess.assertClient(req.organizationId, req.user, grid.clientId);
        grid.status = dto.status;
        const saved = await this.gridRepo.save(grid);
        const status = { draft: 'pending', submitted: 'in_review', rejected: 'correction', approved: 'completed', published: 'completed' }[dto.status] ?? 'pending';
        const period = new Date(grid.weekStart);
        await this.gridRepo.manager.query('UPDATE account_cycles SET grid_status = ? WHERE organization_id = ? AND client_id = ? AND year = ? AND month = ?', [status, req.organizationId, grid.clientId, period.getFullYear(), period.getMonth() + 1]);
        return saved;
    }
    async updateItem(id, dto, req) {
        const item = await this.itemRepo.findOne({ where: { id }, relations: ['contentGrid'] });
        if (!item || item.contentGrid.organizationId !== req.organizationId) {
            throw new common_1.NotFoundException('Content item not found');
        }
        await this.accountAccess.assertClient(req.organizationId, req.user, item.contentGrid.clientId);
        Object.assign(item, dto, { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : item.scheduledAt });
        return this.itemRepo.save(item);
    }
    async deleteItem(id, req) {
        const item = await this.itemRepo.findOne({ where: { id }, relations: ['contentGrid'] });
        if (!item || item.contentGrid.organizationId !== req.organizationId) {
            throw new common_1.NotFoundException('Content item not found');
        }
        return this.itemRepo.remove(item);
    }
};
exports.ContentController = ContentController;
__decorate([
    (0, common_1.Post)('content/grids'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Crear parrilla de contenido semanal' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_grid_dto_1.CreateGridDto, Object]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('content/grids'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Listar parrillas de contenido' }),
    __param(0, (0, common_1.Query)('clientId')),
    __param(1, (0, common_1.Query)('month')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('content/grids/:gridId/items'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Agregar una publicación a una parrilla' }),
    __param(0, (0, common_1.Param)('gridId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, add_content_item_dto_1.AddContentItemDto, Object]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "addItem", null);
__decorate([
    (0, common_1.Put)('content/grids/:id/status'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar estado de una parrilla' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_grid_status_dto_1.UpdateGridStatusDto, Object]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "updateGridStatus", null);
__decorate([
    (0, common_1.Put)('content/items/:id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar item de contenido' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_item_dto_1.UpdateContentItemDto, Object]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "updateItem", null);
__decorate([
    (0, common_1.Delete)('content/items/:id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Eliminar item de contenido' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ContentController.prototype, "deleteItem", null);
exports.ContentController = ContentController = __decorate([
    (0, swagger_1.ApiTags)('Parrillas de Contenido'),
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('content'),
    __param(2, (0, typeorm_1.InjectRepository)(content_item_entity_1.ContentItem)),
    __param(3, (0, typeorm_1.InjectRepository)(content_grid_entity_1.ContentGrid)),
    __metadata("design:paramtypes", [create_content_grid_use_case_1.CreateContentGridUseCase,
        list_content_grids_use_case_1.ListContentGridsUseCase,
        typeorm_2.Repository,
        typeorm_2.Repository,
        account_access_service_1.AccountAccessService])
], ContentController);
//# sourceMappingURL=content.controller.js.map