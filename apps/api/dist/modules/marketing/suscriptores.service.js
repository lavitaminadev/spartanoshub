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
            creados: 0, actualizados: 0, respetadosDeBaja: 0, excluidos: 0, descartados: descartadas,
        };
        const empresa = clientId ?? null;
        for (const fila of filas) {
            if (await this.exclusionDe(organizationId, fila.email, empresa)) {
                resultado.excluidos += 1;
                continue;
            }
            const existente = await this.repo.findOne({
                where: { organizationId, clientId: empresa ?? (0, typeorm_2.IsNull)(), email: fila.email },
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
                clientId: empresa,
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
            + `${resultado.respetadosDeBaja} de baja respetados, ${resultado.excluidos} excluidos, ${descartadas.length} descartados`);
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
    async aQuienPertenece(token) {
        const suscriptor = await this.repo.findOne({ where: { unsubscribeToken: token } });
        if (!suscriptor)
            return null;
        return {
            email: suscriptor.email,
            empresa: suscriptor.clientId ?? null,
            yaDeBaja: suscriptor.status === suscriptor_entity_1.EstadoDeSuscripcion.BAJA,
        };
    }
    async consultarExclusion(organizationId, email) {
        const limpio = email?.trim().toLowerCase();
        if (!limpio)
            return { alcance: null, empresas: [] };
        const filas = await this.exclusiones.find({
            where: { organizationId, huella: this.huellaDe(organizationId, limpio) },
            order: { createdAt: 'DESC' },
        });
        return {
            alcance: filas.length === 0 ? null : filas.some((fila) => fila.clientId === null) ? 'todas' : 'local',
            empresas: filas.map((fila) => ({
                clientId: fila.clientId ?? null,
                alcance: fila.alcance,
                origen: fila.origen ?? null,
                cuando: fila.createdAt,
            })),
        };
    }
    async cuantasExclusiones(organizationId) {
        const [total, deTodas] = await Promise.all([
            this.exclusiones.count({ where: { organizationId } }),
            this.exclusiones.count({ where: { organizationId, clientId: (0, typeorm_2.IsNull)() } }),
        ]);
        return { total, deTodas };
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
    async listar(organizationId, filtros = {}) {
        const where = { organizationId };
        const empresa = filtros.encerradoEn ?? filtros.empresa;
        if (empresa === 'agencia')
            where.clientId = (0, typeorm_2.IsNull)();
        else if (empresa)
            where.clientId = empresa;
        if (filtros.estado)
            where.status = filtros.estado;
        if (filtros.origen)
            where.source = filtros.origen;
        const texto = filtros.busqueda?.trim();
        const condiciones = texto
            ? [{ ...where, email: (0, typeorm_2.Like)(`%${texto.toLowerCase()}%`) }, { ...where, name: (0, typeorm_2.Like)(`%${texto}%`) }]
            : where;
        const [data, total] = await this.repo.findAndCount({
            where: condiciones,
            order: { createdAt: 'DESC' },
            take: Math.min(Math.max(filtros.limite ?? 200, 1), 1000),
        });
        const consulta = this.repo
            .createQueryBuilder('s')
            .select('s.client_id', 'clientId')
            .addSelect('s.status', 'status')
            .addSelect('COUNT(*)', 'cuantos')
            .where('s.organization_id = :organizationId', { organizationId });
        if (filtros.encerradoEn)
            consulta.andWhere('s.client_id = :encerradoEn', { encerradoEn: filtros.encerradoEn });
        const filas = await consulta
            .groupBy('s.client_id')
            .addGroupBy('s.status')
            .getRawMany()
            .catch((error) => {
            this.logger.warn(`No se pudo contar por empresa: ${error instanceof Error ? error.message : error}`);
            return [];
        });
        const consultaDeOrigenes = this.repo
            .createQueryBuilder('s')
            .select('DISTINCT s.source', 'source')
            .where('s.organization_id = :organizationId', { organizationId });
        if (filtros.encerradoEn)
            consultaDeOrigenes.andWhere('s.client_id = :encerradoEn', { encerradoEn: filtros.encerradoEn });
        const origenes = await consultaDeOrigenes
            .getRawMany()
            .then((filas) => filas.map((fila) => fila.source).filter((valor) => Boolean(valor)).sort())
            .catch((error) => {
            this.logger.warn(`No se pudieron listar las procedencias: ${error instanceof Error ? error.message : error}`);
            return [];
        });
        const resumen = new Map();
        for (const fila of filas) {
            const clave = fila.clientId ?? null;
            const actual = resumen.get(clave) ?? { clientId: clave, suscritos: 0, bajas: 0, pendientes: 0 };
            const cuantos = Number(fila.cuantos) || 0;
            if (fila.status === suscriptor_entity_1.EstadoDeSuscripcion.SUSCRITO)
                actual.suscritos += cuantos;
            else if (fila.status === suscriptor_entity_1.EstadoDeSuscripcion.BAJA)
                actual.bajas += cuantos;
            else
                actual.pendientes += cuantos;
            resumen.set(clave, actual);
        }
        return { data, total, resumen: [...resumen.values()], origenes };
    }
    async paraDescargar(organizationId, empresa) {
        return this.repo.find({
            where: {
                organizationId,
                clientId: empresa === 'agencia' ? (0, typeorm_2.IsNull)() : empresa,
                status: suscriptor_entity_1.EstadoDeSuscripcion.SUSCRITO,
            },
            order: { createdAt: 'DESC' },
            take: 5000,
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
