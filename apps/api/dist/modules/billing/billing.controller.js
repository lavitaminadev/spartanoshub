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
exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const create_invoice_use_case_1 = require("./use-cases/create-invoice.use-case");
const list_invoices_use_case_1 = require("./use-cases/list-invoices.use-case");
const list_charge_notes_use_case_1 = require("./use-cases/list-charge-notes.use-case");
const price_charge_note_use_case_1 = require("./use-cases/price-charge-note.use-case");
const create_invoice_dto_1 = require("./dto/create-invoice.dto");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const price_charge_note_dto_1 = require("./dto/price-charge-note.dto");
const pagination_dto_1 = require("../../shared/dto/pagination.dto");
const requires_feature_decorator_1 = require("../../core/authorization/requires-feature.decorator");
let BillingController = class BillingController {
    constructor(createInvoice, listInvoices, listChargeNotes, priceChargeNote) {
        this.createInvoice = createInvoice;
        this.listInvoices = listInvoices;
        this.listChargeNotes = listChargeNotes;
        this.priceChargeNote = priceChargeNote;
    }
    create(dto, req) {
        return this.createInvoice.execute(dto, req.organizationId, req.user);
    }
    list(pagination, req) {
        return this.listInvoices.execute(req.organizationId, pagination.limit, pagination.offset);
    }
    chargeNotes(req) {
        return this.listChargeNotes.execute(req.organizationId);
    }
    priceNote(id, body, req) {
        return this.priceChargeNote.execute(id, req.organizationId, body.amount);
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Crear factura' }),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_invoice_dto_1.CreateInvoiceDto, Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar facturas' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationDto, Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('charge-notes'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "chargeNotes", null);
__decorate([
    (0, common_1.Put)('charge-notes/:id/price'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, price_charge_note_dto_1.PriceChargeNoteDto, Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "priceNote", null);
exports.BillingController = BillingController = __decorate([
    (0, swagger_1.ApiTags)('Facturación'),
    (0, common_1.Controller)('billing/invoices'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, requires_feature_decorator_1.RequiresFeature)('billing'),
    __metadata("design:paramtypes", [create_invoice_use_case_1.CreateInvoiceUseCase,
        list_invoices_use_case_1.ListInvoicesUseCase,
        list_charge_notes_use_case_1.ListChargeNotesUseCase,
        price_charge_note_use_case_1.PriceChargeNoteUseCase])
], BillingController);
