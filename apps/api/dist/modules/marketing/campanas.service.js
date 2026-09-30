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
var CampanasService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampanasService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const campana_entity_1 = require("./campana.entity");
const suscriptores_service_1 = require("./suscriptores.service");
const envios_de_campana_service_1 = require("./envios-de-campana.service");
const plantilla_de_correo_1 = require("../../core/notifications/plantilla-de-correo");
const parameter_resolver_service_1 = require("../../core/parameters/parameter-resolver.service");
let CampanasService = CampanasService_1 = class CampanasService {
    constructor(repo, suscriptores, envios, parametros) {
        this.repo = repo;
        this.suscriptores = suscriptores;
        this.envios = envios;
        this.parametros = parametros;
        this.logger = new common_1.Logger(CampanasService_1.name);
    }
    empresaDe(empresa) {
        return !empresa || empresa === 'agencia' ? null : empresa;
    }
    async listar(organizationId, encerradoEn) {
        return this.repo.find({
            where: { organizationId, ...(encerradoEn ? { clientId: encerradoEn } : {}) },
            order: { createdAt: 'DESC' },
            take: 100,
        });
    }
    async crear(datos) {
        const asunto = datos.asunto?.trim();
        const cuerpo = datos.cuerpo?.trim();
        if (!asunto || !cuerpo)
            throw new common_1.BadRequestException('La campaña necesita asunto y texto');
        return this.repo.save(this.repo.create({
            organizationId: datos.organizationId,
            clientId: this.empresaDe(datos.clientId),
            asunto,
            cuerpo,
            estado: campana_entity_1.EstadoDeCampana.BORRADOR,
            createdBy: datos.createdBy ?? null,
        }));
    }
    async editar(id, organizationId, cambios) {
        const campana = await this.buscar(id, organizationId);
        if (campana.estado !== campana_entity_1.EstadoDeCampana.BORRADOR) {
            throw new common_1.ConflictException('Esta campaña ya se envió: su texto es la constancia de lo que salió');
        }
        if (cambios.asunto !== undefined)
            campana.asunto = cambios.asunto.trim();
        if (cambios.cuerpo !== undefined)
            campana.cuerpo = cambios.cuerpo.trim();
        if (!campana.asunto || !campana.cuerpo)
            throw new common_1.BadRequestException('La campaña necesita asunto y texto');
        return this.repo.save(campana);
    }
    async borrar(id, organizationId) {
        const campana = await this.buscar(id, organizationId);
        if (campana.estado !== campana_entity_1.EstadoDeCampana.BORRADOR) {
            throw new common_1.ConflictException('Una campaña enviada no se borra: es la constancia de lo que salió');
        }
        await this.repo.remove(campana);
    }
    vistaPrevia(asunto, cuerpo) {
        const base = process.env.APP_PUBLIC_URL?.replace(/\/$/, '') ?? '';
        return (0, plantilla_de_correo_1.componerCorreo)(asunto ?? '', cuerpo ?? '', { nombre: 'Ana' }, undefined, undefined, undefined, `${base}/api/marketing/suscriptores/baja/de-muestra`);
    }
    async destinatarios(organizationId, empresa) {
        const lista = await this.suscriptores.suscritos(organizationId, this.empresaDe(empresa));
        return lista.length;
    }
    async enviar(id, organizationId) {
        const campana = await this.buscar(id, organizationId);
        if (campana.estado !== campana_entity_1.EstadoDeCampana.BORRADOR) {
            throw new common_1.ConflictException('Esta campaña ya se envió');
        }
        const destinatarios = await this.suscriptores.suscritos(organizationId, campana.clientId ?? null);
        if (!destinatarios.length) {
            throw new common_1.ConflictException('No hay nadie suscrito en esta lista ahora mismo');
        }
        const tomada = await this.repo.update({ id: campana.id, estado: campana_entity_1.EstadoDeCampana.BORRADOR }, { estado: campana_entity_1.EstadoDeCampana.ENVIANDO });
        if (!tomada.affected)
            throw new common_1.ConflictException('Esta campaña ya se está enviando');
        const encolados = await this.envios.encolar(campana, destinatarios);
        await this.repo.update(campana.id, { destinatarios: encolados });
        this.logger.log(`Campaña ${campana.id}: ${encolados} destinatarios en cola`);
        return { destinatarios: encolados, enviados: 0, fallidos: 0, enCola: true };
    }
    async avance(id, organizationId) {
        const campana = await this.buscar(id, organizationId);
        return { estado: campana.estado, ...await this.envios.avanceDe(campana.id) };
    }
    async buscar(id, organizationId) {
        const campana = await this.repo.findOne({ where: { id, organizationId } });
        if (!campana)
            throw new common_1.NotFoundException('Esta campaña no existe');
        return campana;
    }
};
exports.CampanasService = CampanasService;
exports.CampanasService = CampanasService = CampanasService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(campana_entity_1.Campana)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        suscriptores_service_1.SuscriptoresService,
        envios_de_campana_service_1.EnviosDeCampanaService,
        parameter_resolver_service_1.ParameterResolver])
], CampanasService);
