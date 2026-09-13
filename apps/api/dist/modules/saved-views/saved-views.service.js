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
exports.SavedViewsService = exports.MAXIMO_VISTAS_POR_LISTA = void 0;
exports.limpiarFiltros = limpiarFiltros;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const saved_view_entity_1 = require("./saved-view.entity");
const AMBITO = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+){1,3}$/;
const MAXIMO_FILTROS = 20;
const LARGO_MAXIMO_VALOR = 200;
exports.MAXIMO_VISTAS_POR_LISTA = 20;
function limpiarFiltros(filtros) {
    if (!filtros || typeof filtros !== 'object' || Array.isArray(filtros))
        throw new common_1.BadRequestException('Los filtros no tienen un formato válido');
    const entradas = Object.entries(filtros);
    if (entradas.length > MAXIMO_FILTROS)
        throw new common_1.BadRequestException('Demasiados filtros en una vista');
    const limpios = {};
    for (const [clave, valor] of entradas) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(clave))
            throw new common_1.BadRequestException(`Filtro inválido: ${clave.slice(0, 40)}`);
        if (valor === null || valor === undefined || valor === '')
            continue;
        if (typeof valor !== 'string' && typeof valor !== 'number' && typeof valor !== 'boolean')
            throw new common_1.BadRequestException(`El filtro ${clave} no es texto`);
        limpios[clave] = String(valor).slice(0, LARGO_MAXIMO_VALOR);
    }
    return limpios;
}
let SavedViewsService = class SavedViewsService {
    constructor(vistas) {
        this.vistas = vistas;
    }
    validarAmbito(scope) {
        const limpio = (scope ?? '').trim();
        if (!AMBITO.test(limpio) || limpio.length > 80)
            throw new common_1.BadRequestException('Lista inválida');
        return limpio;
    }
    empresaDe(user) {
        return user.clientId ?? null;
    }
    async listar(user, scope) {
        const ambito = this.validarAmbito(scope);
        const empresa = this.empresaDe(user);
        const qb = this.vistas.createQueryBuilder('v')
            .where('v.organizationId = :org AND v.scope = :ambito', { org: user.organizationId, ambito })
            .andWhere(empresa ? 'v.clientId = :empresa' : 'v.clientId IS NULL', empresa ? { empresa } : {})
            .andWhere(new typeorm_2.Brackets((w) => w.where('v.ownerUserId = :yo', { yo: user.id }).orWhere('v.shared = :si', { si: true })))
            .orderBy('v.name', 'ASC')
            .take(100);
        const filas = await qb.getMany();
        return filas.map((fila) => ({ id: fila.id, name: fila.name, filters: fila.filters ?? {}, shared: fila.shared, propia: fila.ownerUserId === user.id }));
    }
    async guardar(user, datos) {
        const ambito = this.validarAmbito(datos.scope);
        const nombre = (datos.name ?? '').trim().slice(0, 60);
        if (!nombre)
            throw new common_1.BadRequestException('La vista necesita un nombre');
        const filtros = limpiarFiltros(datos.filters);
        const existente = await this.vistas.findOne({ where: { ownerUserId: user.id, scope: ambito, name: nombre } });
        if (!existente) {
            const cuantas = await this.vistas.count({ where: { ownerUserId: user.id, scope: ambito } });
            if (cuantas >= exports.MAXIMO_VISTAS_POR_LISTA)
                throw new common_1.BadRequestException(`Ya tienes ${exports.MAXIMO_VISTAS_POR_LISTA} vistas en esta lista. Borra alguna para guardar otra.`);
        }
        const guardada = await this.vistas.save(this.vistas.create({
            ...(existente ?? {}),
            organizationId: user.organizationId,
            clientId: this.empresaDe(user),
            ownerUserId: user.id,
            scope: ambito,
            name: nombre,
            filters: filtros,
            shared: datos.shared ?? existente?.shared ?? false,
        }));
        return { id: guardada.id, name: guardada.name, filters: guardada.filters, shared: guardada.shared, propia: true };
    }
    async propia(user, id) {
        const vista = await this.vistas.findOne({ where: { id, organizationId: user.organizationId } });
        if (!vista)
            throw new common_1.NotFoundException('Vista no encontrada');
        if (vista.ownerUserId !== user.id)
            throw new common_1.ForbiddenException('Sólo quien creó la vista puede cambiarla');
        return vista;
    }
    async compartir(user, id, shared) {
        const vista = await this.propia(user, id);
        vista.shared = Boolean(shared);
        const guardada = await this.vistas.save(vista);
        return { id: guardada.id, name: guardada.name, filters: guardada.filters, shared: guardada.shared, propia: true };
    }
    async borrar(user, id) {
        const vista = await this.propia(user, id);
        await this.vistas.delete({ id: vista.id });
        return { deleted: true };
    }
};
exports.SavedViewsService = SavedViewsService;
exports.SavedViewsService = SavedViewsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(saved_view_entity_1.SavedView)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SavedViewsService);
