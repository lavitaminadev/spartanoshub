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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NivelDeDatosService = void 0;
exports.elMasRestrictivo = elMasRestrictivo;
exports.nivelesFijos = nivelesFijos;
exports.recortarFilasPorEmpresa = recortarFilasPorEmpresa;
const common_1 = require("@nestjs/common");
const shared_1 = require("@espartanos/shared");
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
    constructor(administradores) {
        this.administradores = administradores;
    }
    async nivelesDe(organizationId, userId, _modulo) {
        const administradas = new Set(await this.administradores.empresasQueAdministra(organizationId, userId));
        const de = (clientId) => clientId && administradas.has(clientId) ? 'directo' : 'bajo_registro';
        return {
            de,
            deTodas: (clientIds) => (clientIds === undefined ? 'bajo_registro' : elMasRestrictivo(clientIds.map(de))),
        };
    }
};
exports.NivelDeDatosService = NivelDeDatosService;
exports.NivelDeDatosService = NivelDeDatosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [administradores_de_empresa_service_1.AdministradoresDeEmpresaService])
], NivelDeDatosService);
