"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountAccessModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const client_entity_1 = require("../../modules/clients/client.entity");
const pod_member_entity_1 = require("../../modules/pods/pod-member.entity");
const account_access_service_1 = require("./account-access.service");
const user_client_access_entity_1 = require("./user-client-access.entity");
let AccountAccessModule = class AccountAccessModule {
};
exports.AccountAccessModule = AccountAccessModule;
exports.AccountAccessModule = AccountAccessModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([client_entity_1.Client, pod_member_entity_1.PodMember, user_client_access_entity_1.UserClientAccess])],
        providers: [account_access_service_1.AccountAccessService],
        exports: [account_access_service_1.AccountAccessService],
    })
], AccountAccessModule);
//# sourceMappingURL=account-access.module.js.map