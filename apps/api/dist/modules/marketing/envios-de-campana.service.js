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
var EnviosDeCampanaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnviosDeCampanaService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const outbox_processor_base_1 = require("../../core/outbox/outbox-processor.base");
const envio_de_campana_entity_1 = require("./envio-de-campana.entity");
const campana_entity_1 = require("./campana.entity");
const suscriptor_entity_1 = require("./suscriptor.entity");
const suscriptores_service_1 = require("./suscriptores.service");
const email_service_1 = require("../../core/notifications/email.service");
const plantilla_de_correo_1 = require("../../core/notifications/plantilla-de-correo");
const enlace_de_baja_1 = require("../../core/notifications/enlace-de-baja");
const parameter_resolver_service_1 = require("../../core/parameters/parameter-resolver.service");
let EnviosDeCampanaService = EnviosDeCampanaService_1 = class EnviosDeCampanaService extends outbox_processor_base_1.OutboxProcessor {
    constructor(repository, campanas, suscriptores, listaDeCorreo, correo, parametros) {
        super();
        this.repository = repository;
        this.campanas = campanas;
        this.suscriptores = suscriptores;
        this.listaDeCorreo = listaDeCorreo;
        this.correo = correo;
        this.parametros = parametros;
        this.logger = new common_1.Logger(EnviosDeCampanaService_1.name);
        this.entity = envio_de_campana_entity_1.EnvioDeCampana;
        this.label = 'Campañas';
        this.maxAttempts = 3;
    }
    async encolar(campana, destinatarios) {
        const exigeToken = (campana.destino ?? 'lista') === 'lista';
        const conToken = destinatarios.filter((suscriptor) => {
            if (!exigeToken || suscriptor.unsubscribeToken)
                return true;
            this.logger.warn(`Suscriptor ${suscriptor.id ?? suscriptor.email} sin token de baja: queda fuera de la campaña ${campana.id}`);
            return false;
        });
        if (!conToken.length)
            return 0;
        await this.repository
            .createQueryBuilder()
            .insert()
            .into(envio_de_campana_entity_1.EnvioDeCampana)
            .values(conToken.map((suscriptor) => ({
            organizationId: campana.organizationId,
            campanaId: campana.id,
            suscriptorId: suscriptor.id,
            email: suscriptor.email,
            status: 'pending',
        })))
            .orIgnore()
            .execute();
        return conToken.length;
    }
    async avanceDe(campanaId) {
        const filas = await this.repository
            .createQueryBuilder('e')
            .select('e.status', 'status')
            .addSelect('COUNT(*)', 'cuantos')
            .where('e.campana_id = :campanaId', { campanaId })
            .groupBy('e.status')
            .getRawMany();
        const por = (...estados) => filas
            .filter((fila) => estados.includes(fila.status))
            .reduce((suma, fila) => suma + (Number(fila.cuantos) || 0), 0);
        return {
            enviados: por('processed'),
            pendientes: por('pending', 'retry', 'processing'),
            fallidos: por('failed', 'expired'),
        };
    }
    async expirationReason(item) {
        const suscriptor = await this.suscriptores.findOne({ where: { id: item.suscriptorId } });
        if (!suscriptor)
            return 'La ficha ya no existe';
        if (suscriptor.status !== suscriptor_entity_1.EstadoDeSuscripcion.SUSCRITO)
            return 'Se dio de baja antes de que saliera';
        if (!suscriptor.puedeRecibirCampana())
            return 'No puede recibir campañas';
        if (await this.listaDeCorreo.exclusionDe(item.organizationId, suscriptor.email, suscriptor.clientId ?? null)) {
            return 'Pidió no recibir más antes de que saliera';
        }
        return null;
    }
    async send(item) {
        const [campana, suscriptor] = await Promise.all([
            this.campanas.findOne({ where: { id: item.campanaId } }),
            this.suscriptores.findOne({ where: { id: item.suscriptorId } }),
        ]);
        if (!campana)
            throw new Error('La campaña ya no existe');
        if (!suscriptor?.unsubscribeToken)
            throw new Error('La ficha ya no tiene token de baja');
        const baja = await (0, enlace_de_baja_1.enlaceDeBaja)(this.parametros, 'email.campaign', suscriptor.unsubscribeToken, suscriptor);
        const detalle = campana.cupon
            ? [
                { etiqueta: 'Tu código', valor: campana.cupon },
                ...(campana.cuponVence
                    ? [{ etiqueta: 'Válido hasta', valor: campana.cuponVence.toLocaleDateString('es-CL', { dateStyle: 'long' }) }]
                    : []),
            ]
            : undefined;
        const { subject, html } = (0, plantilla_de_correo_1.componerCorreo)(campana.asunto, campana.cuerpo, { nombre: suscriptor.name ?? '', cupon: campana.cupon ?? '' }, undefined, undefined, detalle, baja);
        const salio = await this.correo.send(suscriptor.email, subject, html, baja ? { bajaUrl: baja } : undefined);
        if (!salio)
            throw new Error('El servidor de correo no aceptó el mensaje');
    }
    classifyFailure(error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        const pasajero = /timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket|no aceptó/i.test(mensaje);
        return { retryable: pasajero, tag: pasajero ? '[REINTENTABLE]' : '[DEFINITIVO]' };
    }
    async cerrarTerminadas() {
        const enCurso = await this.campanas.find({ where: { estado: campana_entity_1.EstadoDeCampana.ENVIANDO }, take: 50 });
        let cerradas = 0;
        for (const campana of enCurso) {
            const avance = await this.avanceDe(campana.id);
            if (avance.pendientes > 0)
                continue;
            await this.campanas.update(campana.id, {
                estado: campana_entity_1.EstadoDeCampana.ENVIADA,
                destinatarios: avance.enviados + avance.fallidos,
                enviados: avance.enviados,
                sentAt: new Date(),
            });
            cerradas += 1;
            this.logger.log(`Campaña ${campana.id} terminada: ${avance.enviados} enviados, ${avance.fallidos} sin entregar`);
        }
        return cerradas;
    }
    async cleanup() {
        return { deleted: 0 };
    }
    async reintentarFallidos(campanaId) {
        const resultado = await this.repository.update({ campanaId, status: (0, typeorm_2.In)(['failed']) }, { status: 'pending', attempts: 0, nextAttemptAt: null, lastError: null });
        return resultado.affected ?? 0;
    }
};
exports.EnviosDeCampanaService = EnviosDeCampanaService;
exports.EnviosDeCampanaService = EnviosDeCampanaService = EnviosDeCampanaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(envio_de_campana_entity_1.EnvioDeCampana)),
    __param(1, (0, typeorm_1.InjectRepository)(campana_entity_1.Campana)),
    __param(2, (0, typeorm_1.InjectRepository)(suscriptor_entity_1.Suscriptor)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        suscriptores_service_1.SuscriptoresService,
        email_service_1.EmailService,
        parameter_resolver_service_1.ParameterResolver])
], EnviosDeCampanaService);
