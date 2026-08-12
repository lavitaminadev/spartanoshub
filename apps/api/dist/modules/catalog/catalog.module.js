"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const service_entity_1 = require("./service.entity");
const quote_entity_1 = require("./quote.entity");
const pack_entity_1 = require("./pack.entity");
const catalog_controller_1 = require("./catalog.controller");
const quotes_service_1 = require("./quotes.service");
const client_entity_1 = require("../clients/client.entity");
const lead_entity_1 = require("../crm/leads/lead.entity");
const contract_entity_1 = require("../contracts/contract.entity");
let CatalogModule = class CatalogModule {
};
exports.CatalogModule = CatalogModule;
exports.CatalogModule = CatalogModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([service_entity_1.Service, quote_entity_1.Quote, pack_entity_1.Pack, client_entity_1.Client, lead_entity_1.Lead, contract_entity_1.Contract])],
        controllers: [catalog_controller_1.CatalogController],
        providers: [quotes_service_1.QuotesService],
    })
], CatalogModule);
