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
var SuscriptoresService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuscriptoresService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const node_crypto_1 = require("node:crypto");
const typeorm_2 = require("typeorm");
const suscriptor_entity_1 = require("./suscriptor.entity");
const exclusion_entity_1 = require("./exclusion.entity");
const importar_suscriptores_1 = require("./importar-suscriptores");
let SuscriptoresService = SuscriptoresService_1 = class SuscriptoresService {
    constructor(repo, exclusiones) {
        this.repo = repo;
        this.exclusiones = exclusiones;
        this.logger = new common_1.Logger(SuscriptoresService_1.name);
    }
    nuevoToken() {
        return (0, node_crypto_1.randomBytes)(24).toString('base64url');
    }
    async importarCsv(organizationId, contenido, origen, detalle, textoConsentimiento, clientId) {
        const { filas, descartadas } = (0, importar_suscriptores_1.interpretarCsv)(contenido);
        const resultado = {
            creados: 0, actualizados: 0, respetadosDeBaja: 0, descartados: descartadas,
        };
        for (const fila of filas) {
            const existente = await this.repo.findOne({
                where: { organizationId, email: fila.email },
            });
            if (existente?.status === suscriptor_entity_1.EstadoDeSuscripcion.BAJA) {
                resultado.respetadosDeBaja += 1;
                continue;
            }
            if (existente) {
                existente.name = existente.name ?? fila.name ?? null;
                if (fila.acepta && existente.status !== suscriptor_entity_1.EstadoDeSuscripcion.SUSCRITO) {
                    this.aplicarConsentimiento(existente, fila, textoConsentimiento);
                }
                await this.repo.save(existente);
                resultado.actualizados += 1;
                continue;
            }
            const nuevo = this.repo.create({
                organizationId,
                clientId: clientId ?? null,
                email: fila.email,
                name: fila.name ?? null,
                source: origen,
                sourceDetail: detalle ?? null,
                status: suscriptor_entity_1.EstadoDeSuscripcion.PENDIENTE,
                unsubscribeToken: this.nuevoToken(),
            });
            if (fila.acepta)
                this.aplicarConsentimiento(nuevo, fila, textoConsentimiento);
            await this.repo.save(nuevo);
            resultado.creados += 1;
        }
        this.logger.log(`Importación desde «${origen}»: ${resultado.creados} nuevos, ${resultado.actualizados} actualizados, `
            + `${resultado.respetadosDeBaja} de baja respetados, ${descartadas.length} descartados`);
        return resultado;
    }
    aplicarConsentimiento(suscriptor, fila, texto) {
        suscriptor.status = suscriptor_entity_1.EstadoDeSuscripcion.SUSCRITO;
        suscriptor.consentAt = new Date();
        suscriptor.consentText = texto
            ?? (fila.respuestaCruda ? `Respuesta en el archivo: «${fila.respuestaCruda}»` : null);
    }
    huellaDe(organizationId, email) {
        return (0, node_crypto_1.createHash)('sha256').update(`${organizationId}:${email.trim().toLowerCase()}`).digest('hex');
    }
    async darDeBaja(token, alcance = 'local', origen) {
        const suscriptor = await this.repo.findOne({ where: { unsubscribeToken: token } });
        if (!suscriptor)
            throw new common_1.NotFoundException('Este enlace de baja no es válido');
        const email = suscriptor.email;
        const huella = this.huellaDe(suscriptor.organizationId, email);
        const ahora = new Date();
        const bajar = (fila) => {
            if (fila.status === suscriptor_entity_1.EstadoDeSuscripcion.BAJA && fila.unsubscribedScope)
                return null;
            fila.status = suscriptor_entity_1.EstadoDeSuscripcion.BAJA;
            fila.unsubscribedAt = fila.unsubscribedAt ?? ahora;
            fila.unsubscribedScope = alcance;
            fila.unsubscribedFrom = origen?.slice(0, 80) ?? fila.unsubscribedFrom ?? null;
            return fila;
        };
        if (alcance === 'todas') {
            const todas = await this.repo.find({ where: { organizationId: suscriptor.organizationId, email } });
            const cambiadas = todas.map(bajar).filter((fila) => fila !== null);
            if (cambiadas.length)
                await this.repo.save(cambiadas);
        }
        else {
            const cambiada = bajar(suscriptor);
            if (cambiada)
                await this.repo.save(cambiada);
        }
        await this.anotarExclusion(suscriptor.organizationId, huella, alcance === 'todas' ? null : suscriptor.clientId ?? null, alcance, origen);
        return { email, alcance, empresa: alcance === 'todas' ? null : suscriptor.clientId ?? null };
    }
    async anotarExclusion(organizationId, huella, clientId, alcance, origen) {
        const yaEsta = await this.exclusiones.findOne({ where: { organizationId, huella, clientId: clientId ?? (0, typeorm_2.IsNull)() } });
        if (yaEsta)
            return;
        await this.exclusiones.save(this.exclusiones.create({ organizationId, huella, clientId, alcance, origen: origen?.slice(0, 80) ?? null }));
    }
    async exclusionDe(organizationId, email, clientId) {
        const huella = this.huellaDe(organizationId, email);
        const filas = await this.exclusiones.find({ where: { organizationId, huella } });
        if (filas.some((fila) => fila.clientId === null))
            return 'todas';
        return filas.some((fila) => fila.clientId === clientId) ? 'local' : null;
    }
    async levantarExclusion(organizationId, email, clientId) {
        const huella = this.huellaDe(organizationId, email);
        const filas = await this.exclusiones.find({ where: { organizationId, huella } });
        const quitar = filas.filter((fila) => fila.clientId === clientId || fila.clientId === null);
        if (quitar.length)
            await this.exclusiones.remove(quitar);
    }
    async suscritos(organizationId, clientId) {
        const where = { organizationId, status: suscriptor_entity_1.EstadoDeSuscripcion.SUSCRITO };
        if (clientId !== undefined)
            where.clientId = clientId === null ? (0, typeorm_2.IsNull)() : clientId;
        const candidatos = await this.repo.find({ where, order: { createdAt: 'DESC' } });
        return candidatos.filter((suscriptor) => suscriptor.puedeRecibirCampana());
    }
    listar(organizationId, limite = 200) {
        return this.repo.find({
            where: { organizationId },
            order: { createdAt: 'DESC' },
            take: Math.min(Math.max(limite, 1), 1000),
        });
    }
};
exports.SuscriptoresService = SuscriptoresService;
exports.SuscriptoresService = SuscriptoresService = SuscriptoresService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(suscriptor_entity_1.Suscriptor)),
    __param(1, (0, typeorm_1.InjectRepository)(exclusion_entity_1.ExclusionDeCorreo)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], SuscriptoresService);
