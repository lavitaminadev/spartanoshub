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
exports.VulneracionesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const client_entity_1 = require("../clients/client.entity");
const plazo_de_aviso_1 = require("./plazo-de-aviso");
const vulneracion_entity_1 = require("./vulneracion.entity");
let VulneracionesService = class VulneracionesService {
    constructor(repo, clients) {
        this.repo = repo;
        this.clients = clients;
    }
    async listar(organizationId) {
        const filas = await this.repo.find({ where: { organizationId }, order: { detectedAt: 'DESC' } });
        const ids = [...new Set(filas.flatMap((fila) => fila.clientIds ?? []))];
        const empresas = ids.length ? await this.clients.find({ where: { id: (0, typeorm_2.In)(ids), organizationId }, select: { id: true, name: true } }) : [];
        const nombres = new Map(empresas.map((empresa) => [empresa.id, empresa.name]));
        return filas.map((fila) => this.presentar(fila, nombres));
    }
    async crear(organizationId, actorId, dto) {
        const detectedAt = this.fecha(dto.detectedAt, 'detectedAt');
        this.noFutura(detectedAt);
        const clientIds = await this.empresasValidas(organizationId, dto.clientIds ?? []);
        const fila = this.repo.create({
            organizationId,
            descripcion: dto.descripcion.trim(),
            detectedAt,
            datosAfectados: dto.datosAfectados.trim(),
            titularesAfectados: dto.titularesAfectados ?? null,
            clientIds,
            medidas: dto.medidas?.trim() || null,
            avisoLocalAt: dto.avisoLocalAt ? this.fecha(dto.avisoLocalAt, 'avisoLocalAt') : null,
            avisoAgenciaAt: dto.avisoAgenciaAt ? this.fecha(dto.avisoAgenciaAt, 'avisoAgenciaAt') : null,
            createdBy: actorId ?? null,
        });
        return this.presentar(await this.repo.save(fila));
    }
    async actualizar(organizationId, id, dto) {
        const fila = await this.repo.findOne({ where: { id, organizationId } });
        if (!fila)
            throw new common_1.NotFoundException('Vulneración no encontrada');
        if (dto.descripcion !== undefined)
            fila.descripcion = dto.descripcion.trim();
        if (dto.detectedAt !== undefined) {
            fila.detectedAt = this.fecha(dto.detectedAt, 'detectedAt');
            this.noFutura(fila.detectedAt);
        }
        if (dto.datosAfectados !== undefined)
            fila.datosAfectados = dto.datosAfectados.trim();
        if (dto.titularesAfectados !== undefined)
            fila.titularesAfectados = dto.titularesAfectados;
        if (dto.clientIds !== undefined)
            fila.clientIds = await this.empresasValidas(organizationId, dto.clientIds);
        if (dto.medidas !== undefined)
            fila.medidas = dto.medidas.trim() || null;
        if (dto.avisoLocalAt !== undefined)
            fila.avisoLocalAt = this.fecha(dto.avisoLocalAt, 'avisoLocalAt');
        if (dto.avisoAgenciaAt !== undefined)
            fila.avisoAgenciaAt = this.fecha(dto.avisoAgenciaAt, 'avisoAgenciaAt');
        return this.presentar(await this.repo.save(fila));
    }
    presentar(fila, nombres) {
        const plazo = (0, plazo_de_aviso_1.plazoDeAviso)(fila.detectedAt, fila.avisoLocalAt);
        return {
            id: fila.id,
            descripcion: fila.descripcion,
            detectedAt: fila.detectedAt,
            datosAfectados: fila.datosAfectados,
            titularesAfectados: fila.titularesAfectados ?? null,
            clientIds: fila.clientIds ?? [],
            empresas: (fila.clientIds ?? []).map((id) => ({ id, name: nombres?.get(id) ?? null })),
            medidas: fila.medidas ?? null,
            avisoLocalAt: fila.avisoLocalAt ?? null,
            avisoAgenciaAt: fila.avisoAgenciaAt ?? null,
            plazo: { vence: plazo.vence, horasRestantes: Math.round(plazo.horasRestantes * 10) / 10, estado: plazo.estado },
            createdAt: fila.createdAt,
        };
    }
    fecha(valor, campo) {
        const fecha = new Date(valor);
        if (Number.isNaN(fecha.getTime()))
            throw new common_1.BadRequestException(`Fecha inválida en ${campo}`);
        return fecha;
    }
    noFutura(fecha) {
        if (fecha.getTime() > Date.now() + 5 * 60_000)
            throw new common_1.BadRequestException('La fecha de detección no puede ser futura');
    }
    async empresasValidas(organizationId, ids) {
        const unicos = [...new Set(ids)];
        if (!unicos.length)
            return [];
        const encontradas = await this.clients.count({ where: { id: (0, typeorm_2.In)(unicos), organizationId } });
        if (encontradas !== unicos.length)
            throw new common_1.BadRequestException('Alguna empresa indicada no existe en esta organización');
        return unicos;
    }
};
exports.VulneracionesService = VulneracionesService;
exports.VulneracionesService = VulneracionesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(vulneracion_entity_1.Vulneracion)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], VulneracionesService);
