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
exports.StageLabelsService = exports.CLAVE_VOCABULARIO = exports.CLAVE_ROTULOS = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const parameter_definition_entity_1 = require("../../../core/parameters/parameter-definition.entity");
const parameter_value_entity_1 = require("../../../core/parameters/parameter-value.entity");
exports.CLAVE_ROTULOS = 'crm.stage_labels';
exports.CLAVE_VOCABULARIO = 'crm.vocabulary';
let StageLabelsService = class StageLabelsService {
    constructor(definiciones, valores) {
        this.definiciones = definiciones;
        this.valores = valores;
    }
    async get(organizationId, clientId, clave = exports.CLAVE_ROTULOS) {
        const definicion = await this.definiciones.findOne({ where: { key: clave } });
        if (!definicion)
            return {};
        const fila = await this.valores.findOne({
            where: {
                definitionId: definicion.id,
                ...this.alcance(organizationId, clientId),
                validTo: (0, typeorm_2.IsNull)(),
            },
        });
        const guardado = fila?.valueJson?.value;
        return guardado && typeof guardado === 'object' ? guardado : {};
    }
    async set(organizationId, clientId, rotulos, clave = exports.CLAVE_ROTULOS) {
        const definicion = await this.definiciones.findOne({ where: { key: clave } })
            ?? await this.definiciones.save(this.definiciones.create({
                key: clave,
                description: 'Cómo llama cada empresa a las cosas del CRM. Solo cambia lo que se muestra.',
                defaultValue: { value: {} },
            }));
        const limpios = {};
        for (const [estado, rotulo] of Object.entries(rotulos)) {
            const texto = String(rotulo ?? '').trim();
            if (texto)
                limpios[estado] = texto.slice(0, 40);
        }
        const alcance = this.alcance(organizationId, clientId);
        const existente = await this.valores.findOne({
            where: { definitionId: definicion.id, ...alcance, validTo: (0, typeorm_2.IsNull)() },
        });
        if (existente) {
            existente.valueJson = { value: limpios };
            existente.version += 1;
            await this.valores.save(existente);
        }
        else {
            await this.valores.save(this.valores.create({
                definitionId: definicion.id,
                ...alcance,
                valueJson: { value: limpios },
            }));
        }
        return limpios;
    }
    alcance(organizationId, clientId) {
        return clientId
            ? { scopeType: 'client', scopeId: clientId }
            : { scopeType: 'organization', scopeId: organizationId };
    }
};
exports.StageLabelsService = StageLabelsService;
exports.StageLabelsService = StageLabelsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(parameter_definition_entity_1.ParameterDefinition)),
    __param(1, (0, typeorm_1.InjectRepository)(parameter_value_entity_1.ParameterValue)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], StageLabelsService);
