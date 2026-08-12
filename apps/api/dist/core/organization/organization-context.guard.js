"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationContextGuard = void 0;
const common_1 = require("@nestjs/common");
const organization_context_1 = require("./organization-context");
let OrganizationContextGuard = class OrganizationContextGuard {
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const organizationId = req.user?.organizationId;
        if (!organizationId)
            return true;
        req.organizationId = organizationId;
        const store = organization_context_1.organizationContext.getStore();
        if (store)
            store.organizationId = organizationId;
        return true;
    }
};
exports.OrganizationContextGuard = OrganizationContextGuard;
exports.OrganizationContextGuard = OrganizationContextGuard = __decorate([
    (0, common_1.Injectable)()
], OrganizationContextGuard);
