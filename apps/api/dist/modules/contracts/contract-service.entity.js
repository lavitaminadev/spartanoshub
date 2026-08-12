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
exports.ContractService = void 0;
const typeorm_1 = require("typeorm");
const contract_entity_1 = require("./contract.entity");
let ContractService = class ContractService {
};
exports.ContractService = ContractService;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ContractService.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'contract_id', type: 'uuid' }),
    __metadata("design:type", String)
], ContractService.prototype, "contractId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => contract_entity_1.Contract),
    (0, typeorm_1.JoinColumn)({ name: 'contract_id' }),
    __metadata("design:type", contract_entity_1.Contract)
], ContractService.prototype, "contract", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'service_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], ContractService.prototype, "serviceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pack_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], ContractService.prototype, "packId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], ContractService.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'unit_price', type: 'decimal', precision: 18, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], ContractService.prototype, "unitPrice", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ContractService.prototype, "createdAt", void 0);
exports.ContractService = ContractService = __decorate([
    (0, typeorm_1.Entity)('contract_services')
], ContractService);
