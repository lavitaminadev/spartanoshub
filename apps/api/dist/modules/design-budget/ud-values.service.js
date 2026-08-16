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
exports.UdValuesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const piece_type_definition_entity_1 = require("../production/piece-type-definition.entity");
const parameter_resolver_service_1 = require("../../core/parameters/parameter-resolver.service");
const piece_type_enum_1 = require("../production/piece-type.enum");
const ud_calculator_1 = require("./ud-calculator");
let UdValuesService = class UdValuesService {
    constructor(parameters, definitions) {
        this.parameters = parameters;
        this.definitions = definitions;
    }
    async matrixFor(organizationId) {
        const keys = Object.values(piece_type_enum_1.PieceType).map(ud_calculator_1.udValueKey);
        const configured = await this.parameters.getManyForOrganization(keys, organizationId);
        const matrix = {};
        for (const type of Object.values(piece_type_enum_1.PieceType)) {
            const value = configured.get((0, ud_calculator_1.udValueKey)(type));
            matrix[type] = value === null || value === undefined ? ud_calculator_1.UD_DEFAULTS[type] ?? null : Number(value);
        }
        if (!organizationId)
            return matrix;
        const definiciones = await this.definitions.find({
            where: { organizationId, status: (0, typeorm_2.In)([piece_type_definition_entity_1.PieceTypeStatus.ACTIVE, piece_type_definition_entity_1.PieceTypeStatus.RETIRED]) },
        });
        for (const definicion of definiciones) {
            matrix[definicion.key] = definicion.udAmount === null || definicion.udAmount === undefined
                ? null
                : Number(definicion.udAmount);
        }
        return matrix;
    }
    async udFor(pieceType, carouselSlides = 0, organizationId) {
        const matrix = await this.matrixFor(organizationId);
        const base = matrix[pieceType];
        if (base === null || base === undefined)
            return 0;
        if (carouselSlides <= 0)
            return base;
        const definicion = organizationId
            ? await this.definitions.findOne({ where: { organizationId, key: pieceType } })
            : null;
        const extraDelTipo = definicion?.extraPerUnit;
        if (extraDelTipo !== null && extraDelTipo !== undefined) {
            return base + Math.max(0, carouselSlides - 1) * Number(extraDelTipo);
        }
        if (pieceType !== piece_type_enum_1.PieceType.CAROUSEL)
            return base;
        const extra = await this.parameters.get(ud_calculator_1.UD_CAROUSEL_EXTRA_KEY, null, null, organizationId);
        const porLamina = extra === null || extra === undefined ? ud_calculator_1.CAROUSEL_EXTRA_PER_SLIDE : Number(extra);
        return base + Math.max(0, carouselSlides - 1) * porLamina;
    }
    async tiposSinValor(organizationId) {
        const matrix = await this.matrixFor(organizationId);
        return Object.keys(matrix).filter((type) => matrix[type] === null || matrix[type] === undefined);
    }
};
exports.UdValuesService = UdValuesService;
exports.UdValuesService = UdValuesService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(piece_type_definition_entity_1.PieceTypeDefinition)),
    __metadata("design:paramtypes", [parameter_resolver_service_1.ParameterResolver,
        typeorm_2.Repository])
], UdValuesService);
