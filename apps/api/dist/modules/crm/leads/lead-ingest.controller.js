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
exports.LeadIngestController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const public_decorator_1 = require("../../../core/auth/decorators/public.decorator");
const lead_ingest_service_1 = require("./lead-ingest.service");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const ingest_lead_dto_1 = require("./dto/ingest-lead.dto");
const normalizar_cuerpo_entrada_1 = require("./normalizar-cuerpo-entrada");
let LeadIngestController = class LeadIngestController {
    constructor(ingest) {
        this.ingest = ingest;
    }
    async recibir(authorization, cuerpo) {
        const token = this.leerLlave(authorization);
        const dto = await this.validar((0, normalizar_cuerpo_entrada_1.normalizarCuerpoEntrada)(cuerpo ?? {}));
        if (!dto.telefono && !dto.email) {
            throw new common_1.BadRequestException('El lead necesita teléfono o correo. Mapea al menos uno en tu Zap.');
        }
        const { leadId, source } = await this.ingest.ingest(token, dto);
        return { ok: true, leadId, source };
    }
    async validar(cuerpo) {
        const dto = (0, class_transformer_1.plainToInstance)(ingest_lead_dto_1.IngestLeadDto, cuerpo);
        const errores = await (0, class_validator_1.validate)(dto, { whitelist: true });
        if (!errores.length)
            return dto;
        throw new common_1.BadRequestException({
            message: 'Validation failed',
            errors: errores.map((error) => ({
                field: error.property,
                message: Object.values(error.constraints ?? {}).join(', '),
            })),
        });
    }
    leerLlave(authorization) {
        const valor = authorization?.trim();
        if (!valor) {
            throw new common_1.UnauthorizedException('Falta la llave. Agrega la cabecera Authorization con el valor «Bearer tu-llave».');
        }
        return valor.toLowerCase().startsWith('bearer ') ? valor.slice(7).trim() : valor;
    }
};
exports.LeadIngestController = LeadIngestController;
__decorate([
    (0, common_1.Post)(),
    (0, throttler_1.Throttle)({ default: { limit: 120, ttl: 60_000 } }),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LeadIngestController.prototype, "recibir", null);
exports.LeadIngestController = LeadIngestController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Controller)('public/ingest/leads'),
    __metadata("design:paramtypes", [lead_ingest_service_1.LeadIngestService])
], LeadIngestController);
