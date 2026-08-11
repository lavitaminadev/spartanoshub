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
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const charge_note_entity_1 = require("./charge-note.entity");
let BillingService = class BillingService {
    constructor(chargeNotes) {
        this.chargeNotes = chargeNotes;
    }
    createCorrectionCharge(params, manager) {
        const repo = manager?.getRepository(charge_note_entity_1.ChargeNote) ?? this.chargeNotes;
        return repo.save(repo.create({
            ...params,
            status: 'pending_pricing',
            reason: `Correccion de cliente numero ${params.correctionNumber}; supera las 3 rondas incluidas.`,
        }));
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(charge_note_entity_1.ChargeNote)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], BillingService);
//# sourceMappingURL=billing.service.js.map