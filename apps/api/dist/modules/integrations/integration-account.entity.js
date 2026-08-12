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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationAccount = void 0;
const typeorm_1 = require("typeorm");
const integration_entity_1 = require("./integration.entity");
const integration_account_type_enum_1 = require("./integration-account-type.enum");
let IntegrationAccount = class IntegrationAccount {
};
exports.IntegrationAccount = IntegrationAccount;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], IntegrationAccount.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'integration_id', type: 'uuid' }),
    __metadata("design:type", String)
], IntegrationAccount.prototype, "integrationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => integration_entity_1.Integration, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'integration_id' }),
    __metadata("design:type", integration_entity_1.Integration)
], IntegrationAccount.prototype, "integration", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'account_type', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], IntegrationAccount.prototype, "accountType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_id', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], IntegrationAccount.prototype, "externalId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_name', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], IntegrationAccount.prototype, "externalName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'access_token', type: 'text', nullable: true }),
    __metadata("design:type", String)
], IntegrationAccount.prototype, "accessToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'refresh_token', type: 'text', nullable: true }),
    __metadata("design:type", String)
], IntegrationAccount.prototype, "refreshToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_expires_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], IntegrationAccount.prototype, "tokenExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], IntegrationAccount.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], IntegrationAccount.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], IntegrationAccount.prototype, "updatedAt", void 0);
exports.IntegrationAccount = IntegrationAccount = __decorate([
    (0, typeorm_1.Entity)('integration_accounts')
], IntegrationAccount);
