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
var AltaDeSuscriptorDesdeReserva_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AltaDeSuscriptorDesdeReserva = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const node_crypto_1 = require("node:crypto");
const typeorm_2 = require("typeorm");
const suscriptor_entity_1 = require("./suscriptor.entity");
const suscriptores_service_1 = require("./suscriptores.service");
let AltaDeSuscriptorDesdeReserva = AltaDeSuscriptorDesdeReserva_1 = class AltaDeSuscriptorDesdeReserva {
    constructor(suscriptores, suscriptores2) {
        this.suscriptores = suscriptores;
        this.suscriptores2 = suscriptores2;
        this.logger = new common_1.Logger(AltaDeSuscriptorDesdeReserva_1.name);
    }
    async registrar(datos, reactivar = false) {
        const email = datos.email?.trim().toLowerCase();
        if (!email)
            return 'omitida';
        try {
            const exclusion = await this.suscriptores2.exclusionDe(datos.organizationId, email, datos.clientId ?? null);
            if (exclusion && !reactivar)
                return exclusion;
            if (exclusion)
                await this.suscriptores2.levantarExclusion(datos.organizationId, email, datos.clientId ?? null);
            const existente = await this.suscriptores.findOne({
                where: { organizationId: datos.organizationId, clientId: datos.clientId ?? (0, typeorm_2.IsNull)(), email },
            });
            if (existente) {
                if (!existente.birthDate && datos.birthDate)
                    existente.birthDate = new Date(`${datos.birthDate}T00:00:00Z`);
                if (!existente.name && datos.name)
                    existente.name = datos.name;
                if (!existente.adultDeclaredAt && datos.adultDeclared)
                    existente.adultDeclaredAt = new Date();
                if (existente.status === suscriptor_entity_1.EstadoDeSuscripcion.PENDIENTE || reactivar) {
                    existente.status = suscriptor_entity_1.EstadoDeSuscripcion.SUSCRITO;
                    existente.consentAt = datos.consentAt ?? new Date();
                    existente.consentText = datos.consentText ?? existente.consentText ?? null;
                    if (reactivar) {
                        existente.unsubscribedAt = null;
                        existente.unsubscribedScope = null;
                    }
                }
                await this.suscriptores.save(existente);
                return 'alta';
            }
            await this.suscriptores.save(this.suscriptores.create({
                organizationId: datos.organizationId,
                clientId: datos.clientId,
                email,
                name: datos.name ?? null,
                birthDate: datos.birthDate ? new Date(`${datos.birthDate}T00:00:00Z`) : null,
                source: datos.source ?? 'reserva',
                sourceDetail: datos.origen,
                status: suscriptor_entity_1.EstadoDeSuscripcion.SUSCRITO,
                consentAt: datos.consentAt ?? new Date(),
                consentText: datos.consentText ?? null,
                consentIp: datos.consentIp ?? null,
                adultDeclaredAt: datos.adultDeclared ? new Date() : null,
                unsubscribeToken: (0, node_crypto_1.randomBytes)(24).toString('base64url'),
            }));
            return 'alta';
        }
        catch (error) {
            this.logger.warn(`No se pudo sumar a la lista a quien reservó: ${error instanceof Error ? error.message : error}`);
            return 'omitida';
        }
    }
};
exports.AltaDeSuscriptorDesdeReserva = AltaDeSuscriptorDesdeReserva;
exports.AltaDeSuscriptorDesdeReserva = AltaDeSuscriptorDesdeReserva = AltaDeSuscriptorDesdeReserva_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(suscriptor_entity_1.Suscriptor)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        suscriptores_service_1.SuscriptoresService])
], AltaDeSuscriptorDesdeReserva);
