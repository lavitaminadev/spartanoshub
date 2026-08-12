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
exports.CatalogController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const service_entity_1 = require("./service.entity");
const pack_entity_1 = require("./pack.entity");
const service_status_enum_1 = require("./service-status.enum");
const create_service_dto_1 = require("./dto/create-service.dto");
const create_pack_dto_1 = require("./dto/create-pack.dto");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const quotes_service_1 = require("./quotes.service");
const quote_dto_1 = require("./dto/quote.dto");
const requires_feature_decorator_1 = require("../../core/authorization/requires-feature.decorator");
let CatalogController = class CatalogController {
    constructor(serviceRepo, packRepo, quotes) {
        this.serviceRepo = serviceRepo;
        this.packRepo = packRepo;
        this.quotes = quotes;
    }
    listServices(req) {
        return this.serviceRepo.find({ where: { organizationId: req.organizationId, status: service_status_enum_1.ServiceStatus.ACTIVE }, order: { name: 'ASC' } });
    }
    createService(dto, req) {
        return this.serviceRepo.save(this.serviceRepo.create({ ...dto, organizationId: req.organizationId, status: service_status_enum_1.ServiceStatus.ACTIVE }));
    }
    async updateService(id, dto, req) {
        const service = await this.serviceRepo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!service)
            throw new common_1.NotFoundException('Servicio no encontrado');
        return this.serviceRepo.save(this.serviceRepo.merge(service, dto));
    }
    async deleteService(id, req) {
        const service = await this.serviceRepo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!service)
            throw new common_1.NotFoundException('Servicio no encontrado');
        service.status = service_status_enum_1.ServiceStatus.ARCHIVED;
        return this.serviceRepo.save(service);
    }
    listPacks(req) {
        return this.packRepo.find({ where: { organizationId: req.organizationId }, order: { createdAt: 'DESC' } });
    }
    createPack(dto, req) {
        return this.packRepo.save(this.packRepo.create({ ...dto, organizationId: req.organizationId }));
    }
    async updatePack(id, dto, req) {
        const pack = await this.packRepo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!pack)
            throw new common_1.NotFoundException('Pack no encontrado');
        return this.packRepo.save(this.packRepo.merge(pack, dto));
    }
    async deletePack(id, req) {
        const pack = await this.packRepo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!pack)
            throw new common_1.NotFoundException('Pack no encontrado');
        await this.packRepo.remove(pack);
        return { deleted: true };
    }
    listQuotes(req) { return this.quotes.list(req.organizationId); }
    createQuote(dto, req) { return this.quotes.create(req.organizationId, req.user.id, dto); }
    updateQuote(id, dto, req) { return this.quotes.update(id, req.organizationId, dto); }
    createQuoteVersion(id, req) { return this.quotes.createVersion(id, req.organizationId, req.user.id); }
    sendQuote(id, req) { return this.quotes.send(id, req.organizationId); }
    acceptQuote(id, req) { return this.quotes.accept(id, req.organizationId, req.user.id); }
};
exports.CatalogController = CatalogController;
__decorate([
    (0, common_1.Get)('services'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "listServices", null);
__decorate([
    (0, common_1.Post)('services'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_service_dto_1.CreateServiceDto, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "createService", null);
__decorate([
    (0, common_1.Put)('services/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_service_dto_1.CreateServiceDto, Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "updateService", null);
__decorate([
    (0, common_1.Delete)('services/:id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "deleteService", null);
__decorate([
    (0, common_1.Get)('packs'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "listPacks", null);
__decorate([
    (0, common_1.Post)('packs'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_pack_dto_1.CreatePackDto, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "createPack", null);
__decorate([
    (0, common_1.Put)('packs/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_pack_dto_1.CreatePackDto, Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "updatePack", null);
__decorate([
    (0, common_1.Delete)('packs/:id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "deletePack", null);
__decorate([
    (0, common_1.Get)('quotes'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "listQuotes", null);
__decorate([
    (0, common_1.Post)('quotes'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [quote_dto_1.CreateQuoteDto, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "createQuote", null);
__decorate([
    (0, common_1.Put)('quotes/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, quote_dto_1.UpdateQuoteDto, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "updateQuote", null);
__decorate([
    (0, common_1.Post)('quotes/:id/version'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "createQuoteVersion", null);
__decorate([
    (0, common_1.Post)('quotes/:id/send'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "sendQuote", null);
__decorate([
    (0, common_1.Post)('quotes/:id/accept'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "acceptQuote", null);
exports.CatalogController = CatalogController = __decorate([
    (0, common_1.Controller)('catalog'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, requires_feature_decorator_1.RequiresFeature)('catalog'),
    __param(0, (0, typeorm_1.InjectRepository)(service_entity_1.Service)),
    __param(1, (0, typeorm_1.InjectRepository)(pack_entity_1.Pack)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        quotes_service_1.QuotesService])
], CatalogController);
