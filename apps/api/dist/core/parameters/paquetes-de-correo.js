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
exports.PaquetesDeCorreo = exports.PAQUETES_DE_CORREO = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const parameter_definition_entity_1 = require("./parameter-definition.entity");
const parameter_value_entity_1 = require("./parameter-value.entity");
exports.PAQUETES_DE_CORREO = {
    reservations: [
        'email.reservation_confirmation_enabled',
        'email.reservation_reminder_enabled',
        'email.reservation_change_enabled',
        'email.reservation_cancellation_enabled',
        'email.reservation_recovery_enabled',
        'email.group_request_ack_enabled',
        'email.waitlist_ack_enabled',
        'email.waitlist_spot_enabled',
        'email.team_new_reservation_enabled',
        'email.team_group_request_enabled',
        'email.team_waitlist_enabled',
    ],
    surveys: ['email.post_visit_survey_enabled'],
    crm: [
        'email.daily_digest_enabled',
        'email.task_reminder_enabled',
        'email.new_lead_enabled',
    ],
};
let PaquetesDeCorreo = class PaquetesDeCorreo {
    constructor(definiciones, valores) {
        this.definiciones = definiciones;
        this.valores = valores;
    }
    async encenderPara(clientId, servicios) {
        const claves = servicios.flatMap((servicio) => exports.PAQUETES_DE_CORREO[servicio] ?? []);
        if (claves.length === 0)
            return [];
        try {
            const definiciones = await this.definiciones.find({ where: { key: (0, typeorm_2.In)(claves) } });
            if (definiciones.length === 0)
                return [];
            const yaDecididas = await this.valores.find({
                where: {
                    definitionId: (0, typeorm_2.In)(definiciones.map((definicion) => definicion.id)),
                    scopeType: 'client',
                    scopeId: clientId,
                    validTo: (0, typeorm_2.IsNull)(),
                },
            });
            const conValorPropio = new Set(yaDecididas.map((valor) => valor.definitionId));
            const nuevas = definiciones.filter((definicion) => !conValorPropio.has(definicion.id));
            if (nuevas.length === 0)
                return [];
            await this.valores.save(nuevas.map((definicion) => this.valores.create({
                definitionId: definicion.id,
                scopeType: 'client',
                scopeId: clientId,
                valueJson: { value: true },
                version: 1,
                validFrom: new Date(),
            })));
            return nuevas.map((definicion) => definicion.key);
        }
        catch {
            return [];
        }
    }
};
exports.PaquetesDeCorreo = PaquetesDeCorreo;
exports.PaquetesDeCorreo = PaquetesDeCorreo = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(parameter_definition_entity_1.ParameterDefinition)),
    __param(1, (0, typeorm_1.InjectRepository)(parameter_value_entity_1.ParameterValue)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], PaquetesDeCorreo);
