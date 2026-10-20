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
exports.NivelDeDatosService = void 0;
exports.elMasRestrictivo = elMasRestrictivo;
exports.nivelesFijos = nivelesFijos;
exports.recortarFilasPorEmpresa = recortarFilasPorEmpresa;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const shared_1 = require("@espartanos/shared");
const perfil_asignacion_entity_1 = require("../../modules/users/perfiles/perfil-asignacion.entity");
const perfil_de_empresa_entity_1 = require("../../modules/users/perfiles/perfil-de-empresa.entity");
const administradores_de_empresa_service_1 = require("../../modules/users/administradores-de-empresa.service");
const ORDEN = ['oculto', 'bajo_registro', 'directo'];
function elMasRestrictivo(niveles) {
    if (niveles.length === 0)
        return 'bajo_registro';
    return niveles.reduce((peor, nivel) => (ORDEN.indexOf(nivel) < ORDEN.indexOf(peor) ? nivel : peor));
}
function nivelesFijos(nivel) {
    return { de: () => nivel, deTodas: () => nivel };
}
function recortarFilasPorEmpresa(filas, modulo, niveles) {
    return filas.map((fila) => {
        const nivel = niveles.de(fila.clientId);
        const { datos, recortados } = (0, shared_1.recortarProtegidos)(fila, modulo, nivel);
        return recortados.length === 0 ? datos : { ...datos, datosProtegidos: { campos: recortados, sePuedePedir: (0, shared_1.sePuedePedir)(nivel) } };
    });
}
let NivelDeDatosService = class NivelDeDatosService {
    constructor(administradores, asignaciones, perfiles) {
        this.administradores = administradores;
        this.asignaciones = asignaciones;
        this.perfiles = perfiles;
    }
    async nivelesDe(organizationId, userId, modulo) {
        const [administradas, porEmpresa] = await Promise.all([
            this.administradores.empresasQueAdministra(organizationId, userId).then((lista) => new Set(lista)),
            this.perfilesPorEmpresa(organizationId, userId),
        ]);
        const de = (clientId) => {
            if (!clientId)
                return 'bajo_registro';
            const perfil = porEmpresa.get(clientId);
            if (perfil)
                return (0, shared_1.datosEfectivos)(perfil.datosProtegidos ?? {}, {}, modulo);
            return administradas.has(clientId) ? 'directo' : 'bajo_registro';
        };
        return {
            de,
            deTodas: (clientIds) => (clientIds === undefined ? 'bajo_registro' : elMasRestrictivo(clientIds.map(de))),
        };
    }
    async perfilesPorEmpresa(organizationId, userId) {
        const asignaciones = await this.asignaciones.find({ where: { organizationId, userId } });
        if (!asignaciones.length)
            return new Map();
        const perfiles = await this.perfiles.find({
            where: { id: (0, typeorm_2.In)(asignaciones.map((asignacion) => asignacion.perfilId)) },
        });
        const porId = new Map(perfiles.map((perfil) => [perfil.id, perfil]));
        const porEmpresa = new Map();
        for (const asignacion of asignaciones) {
            const perfil = porId.get(asignacion.perfilId);
            if (perfil)
                porEmpresa.set(asignacion.clientId, perfil);
        }
        return porEmpresa;
    }
};
exports.NivelDeDatosService = NivelDeDatosService;
exports.NivelDeDatosService = NivelDeDatosService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(perfil_asignacion_entity_1.PerfilAsignacion)),
    __param(2, (0, typeorm_1.InjectRepository)(perfil_de_empresa_entity_1.PerfilDeEmpresa)),
    __metadata("design:paramtypes", [administradores_de_empresa_service_1.AdministradoresDeEmpresaService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], NivelDeDatosService);
