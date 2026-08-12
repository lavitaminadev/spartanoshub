"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const invoice_entity_1 = require("./invoice.entity");
const billing_controller_1 = require("./billing.controller");
const charge_note_entity_1 = require("./charge-note.entity");
const billing_service_1 = require("./billing.service");
const create_invoice_use_case_1 = require("./use-cases/create-invoice.use-case");
const list_invoices_use_case_1 = require("./use-cases/list-invoices.use-case");
const list_charge_notes_use_case_1 = require("./use-cases/list-charge-notes.use-case");
const price_charge_note_use_case_1 = require("./use-cases/price-charge-note.use-case");
const account_access_module_1 = require("../../core/client-scope/account-access.module");
let BillingModule = class BillingModule {
};
exports.BillingModule = BillingModule;
exports.BillingModule = BillingModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([invoice_entity_1.Invoice, charge_note_entity_1.ChargeNote]), account_access_module_1.AccountAccessModule],
        controllers: [billing_controller_1.BillingController],
        providers: [billing_service_1.BillingService, create_invoice_use_case_1.CreateInvoiceUseCase, list_invoices_use_case_1.ListInvoicesUseCase, list_charge_notes_use_case_1.ListChargeNotesUseCase, price_charge_note_use_case_1.PriceChargeNoteUseCase],
        exports: [billing_service_1.BillingService],
    })
], BillingModule);
