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
exports.PieceRulesService = void 0;
const common_1 = require("@nestjs/common");
const parameter_resolver_service_1 = require("../../core/parameters/parameter-resolver.service");
let PieceRulesService = class PieceRulesService {
    constructor(parameters) {
        this.parameters = parameters;
        this.defaultMaxCorrections = 3;
    }
    async canRequestCorrection(currentCount, isDesignerError, organizationId) {
        const maxCorrections = await this.resolveMaxCorrections(organizationId);
        if (!isDesignerError && currentCount >= maxCorrections) {
            return { allowed: true, reason: `La corrección supera las ${maxCorrections} rondas incluidas y será cobrable.` };
        }
        return { allowed: true };
    }
    async shouldGenerateInvoice(clientCorrectionCount, organizationId) {
        return clientCorrectionCount > await this.resolveMaxCorrections(organizationId);
    }
    async resolveMaxCorrections(organizationId) {
        if (!this.parameters || !organizationId)
            return this.defaultMaxCorrections;
        const configured = await this.parameters.get('production.max_client_corrections', null, null, organizationId);
        return Number(configured ?? this.defaultMaxCorrections);
    }
};
exports.PieceRulesService = PieceRulesService;
exports.PieceRulesService = PieceRulesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [parameter_resolver_service_1.ParameterResolver])
], PieceRulesService);
