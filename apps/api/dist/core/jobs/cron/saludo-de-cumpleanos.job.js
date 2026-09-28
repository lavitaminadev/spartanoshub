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
var SaludoDeCumpleanosJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaludoDeCumpleanosJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const typeorm_3 = require("typeorm");
const suscriptor_entity_1 = require("../../../modules/marketing/suscriptor.entity");
const edad_1 = require("../../../modules/marketing/edad");
const email_service_1 = require("../../notifications/email.service");
const plantilla_de_correo_1 = require("../../notifications/plantilla-de-correo");
const parameter_resolver_service_1 = require("../../parameters/parameter-resolver.service");
let SaludoDeCumpleanosJob = SaludoDeCumpleanosJob_1 = class SaludoDeCumpleanosJob {
    constructor(suscriptores, correo, parametros) {
        this.suscriptores = suscriptores;
        this.correo = correo;
        this.parametros = parametros;
        this.logger = new common_1.Logger(SaludoDeCumpleanosJob_1.name);
    }
    async handle() {
        const hoy = new Date();
        const candidatos = await this.suscriptores.find({
            where: { status: suscriptor_entity_1.EstadoDeSuscripcion.SUSCRITO, birthDate: (0, typeorm_2.Not)((0, typeorm_3.IsNull)()) },
        });
        const encendidoPorEmpresa = new Map();
        let enviados = 0;
        for (const suscriptor of candidatos) {
            try {
                if (!suscriptor.birthDate)
                    continue;
                if (!(0, edad_1.cumpleHoy)(new Date(suscriptor.birthDate), hoy))
                    continue;
                if (!suscriptor.puedeRecibirCampana(hoy))
                    continue;
                if (suscriptor.lastSentAt && this.mismoDia(suscriptor.lastSentAt, hoy))
                    continue;
                const clave = `${suscriptor.organizationId}:${suscriptor.clientId ?? 'sin-empresa'}`;
                let encendido = encendidoPorEmpresa.get(clave);
                if (encendido === undefined) {
                    encendido = Boolean(await this.parametros.get('email.birthday_enabled', suscriptor.clientId ?? null, null, suscriptor.organizationId));
                    encendidoPorEmpresa.set(clave, encendido);
                }
                if (!encendido)
                    continue;
                await this.enviar(suscriptor);
                await this.suscriptores.update(suscriptor.id, { lastSentAt: new Date() });
                enviados += 1;
            }
            catch (error) {
                this.logger.error(`No se pudo felicitar a ${suscriptor.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        this.logger.log(`Saludos de cumpleaños enviados: ${enviados} de ${candidatos.length} con fecha`);
    }
    mismoDia(a, b) {
        const uno = (0, edad_1.diaDelAnoEn)(a);
        const otro = (0, edad_1.diaDelAnoEn)(b);
        return uno.ano === otro.ano && uno.mes === otro.mes && uno.dia === otro.dia;
    }
    async enviar(suscriptor) {
        const [asunto, cuerpo] = await Promise.all([
            this.parametros.get('email.birthday_subject', suscriptor.clientId ?? null, null, suscriptor.organizationId),
            this.parametros.get('email.birthday_body', suscriptor.clientId ?? null, null, suscriptor.organizationId),
        ]);
        const { subject, html } = (0, plantilla_de_correo_1.componerCorreo)(String(asunto ?? '¡Feliz cumpleaños, {{nombre}}!'), String(cuerpo ?? 'Que tengas un gran día.'), { nombre: suscriptor.name ?? '' }, this.enlaceDeBaja(suscriptor));
        await this.correo.send(suscriptor.email, subject, html);
    }
    enlaceDeBaja(suscriptor) {
        const base = process.env.APP_PUBLIC_URL?.replace(/\/$/, '');
        if (!base)
            return undefined;
        return {
            texto: 'No quiero recibir más correos',
            url: `${base}/api/marketing/suscriptores/baja/${suscriptor.unsubscribeToken}`,
        };
    }
};
exports.SaludoDeCumpleanosJob = SaludoDeCumpleanosJob;
exports.SaludoDeCumpleanosJob = SaludoDeCumpleanosJob = SaludoDeCumpleanosJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(suscriptor_entity_1.Suscriptor)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        email_service_1.EmailService,
        parameter_resolver_service_1.ParameterResolver])
], SaludoDeCumpleanosJob);
