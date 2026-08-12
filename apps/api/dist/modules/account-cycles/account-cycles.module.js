"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountCyclesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const account_cycle_entity_1 = require("./account-cycle.entity");
const account_cycles_controller_1 = require("./account-cycles.controller");
const account_cycles_service_1 = require("./account-cycles.service");
let AccountCyclesModule = class AccountCyclesModule {
};
exports.AccountCyclesModule = AccountCyclesModule;
exports.AccountCyclesModule = AccountCyclesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([account_cycle_entity_1.AccountCycle])],
        controllers: [account_cycles_controller_1.AccountCyclesController],
        providers: [account_cycles_service_1.AccountCyclesService],
        exports: [account_cycles_service_1.AccountCyclesService],
    })
], AccountCyclesModule);
//# sourceMappingURL=account-cycles.module.js.map