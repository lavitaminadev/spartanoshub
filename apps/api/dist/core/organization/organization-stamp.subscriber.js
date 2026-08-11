"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationStampSubscriber = void 0;
const typeorm_1 = require("typeorm");
const organization_context_1 = require("./organization-context");
let OrganizationStampSubscriber = class OrganizationStampSubscriber {
    beforeInsert(event) {
        const organizationId = organization_context_1.organizationContext.getStore()?.organizationId;
        if (!organizationId)
            return;
        const entity = event.entity;
        if (!entity || entity.organizationId)
            return;
        const hasOrganizationColumn = event.metadata.columns.some((column) => column.propertyName === 'organizationId');
        if (!hasOrganizationColumn)
            return;
        entity.organizationId = organizationId;
    }
};
exports.OrganizationStampSubscriber = OrganizationStampSubscriber;
exports.OrganizationStampSubscriber = OrganizationStampSubscriber = __decorate([
    (0, typeorm_1.EventSubscriber)()
], OrganizationStampSubscriber);
//# sourceMappingURL=organization-stamp.subscriber.js.map