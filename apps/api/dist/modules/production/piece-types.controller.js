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
exports.PieceTypesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const piece_types_service_1 = require("./piece-types.service");
const piece_type_definition_entity_1 = require("./piece-type-definition.entity");
const piece_type_dto_1 = require("./dto/piece-type.dto");
const requires_feature_decorator_1 = require("../../core/authorization/requires-feature.decorator");
let PieceTypesController = class PieceTypesController {
    constructor(service) {
        this.service = service;
    }
    list(area, includeInactive, req) {
        return this.service.list(req.organizationId, { role: req.user.role }, {
            area: area || undefined,
            includeInactive: includeInactive === 'true',
        });
    }
    async canApprove(req) {
        return { canApprove: await this.service.canApprove(req.organizationId, req.user.role) };
    }
    propose(dto, req) {
        return this.service.propose(req.organizationId, dto, req.user.id, req.user.role);
    }
    approve(id, dto, req) {
        return this.service.approve(req.organizationId, id, req.user.role, req.user.id, dto);
    }
    update(id, dto, req) {
        return this.service.update(req.organizationId, id, req.user.role, dto);
    }
    retire(id, body, req) {
        return this.service.retire(req.organizationId, id, req.user.role, body?.reason);
    }
};
exports.PieceTypesController = PieceTypesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar tipos de pieza disponibles' }),
    __param(0, (0, common_1.Query)('area')),
    __param(1, (0, common_1.Query)('includeInactive')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], PieceTypesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('can-approve'),
    (0, swagger_1.ApiOperation)({ summary: 'Indicar si el cargo puede aprobar tipos de pieza' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PieceTypesController.prototype, "canApprove", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Proponer un tipo de pieza nuevo' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [piece_type_dto_1.CreatePieceTypeDto, Object]),
    __metadata("design:returntype", void 0)
], PieceTypesController.prototype, "propose", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, swagger_1.ApiOperation)({ summary: 'Aprobar un tipo de pieza y ponerlo en circulacion' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, piece_type_dto_1.UpdatePieceTypeDto, Object]),
    __metadata("design:returntype", void 0)
], PieceTypesController.prototype, "approve", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Corregir un tipo de pieza del catalogo' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, piece_type_dto_1.UpdatePieceTypeDto, Object]),
    __metadata("design:returntype", void 0)
], PieceTypesController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/retire'),
    (0, swagger_1.ApiOperation)({ summary: 'Retirar un tipo de pieza de circulacion' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], PieceTypesController.prototype, "retire", null);
exports.PieceTypesController = PieceTypesController = __decorate([
    (0, swagger_1.ApiTags)('Produccion'),
    (0, common_1.Controller)('production/piece-types'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, requires_feature_decorator_1.RequiresFeature)('production'),
    __metadata("design:paramtypes", [piece_types_service_1.PieceTypesService])
], PieceTypesController);
