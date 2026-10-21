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
exports.NivelDeAreaService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const shared_1 = require("@espartanos/shared");
const perfil_asignacion_entity_1 = require("../../modules/users/perfiles/perfil-asignacion.entity");
const perfil_de_empresa_entity_1 = require("../../modules/users/perfiles/perfil-de-empresa.entity");
const user_action_override_entity_1 = require("../authorization/user-action-override.entity");
let NivelDeAreaService = class NivelDeAreaService {
    constructor(asignaciones, perfiles, extras) {
        this.asignaciones = asignaciones;
        this.perfiles = perfiles;
        this.extras = extras;
    }
    async alcanzaArea(organizationId, userId, clientId, clave, nivel) {
        if (!(0, shared_1.definicionDeArea)(clave)) {
            throw new Error(`Área desconocida: «${clave}». Las válidas están en packages/shared/src/areas.ts`);
        }
        if (!clientId)
            return true;
        const perfil = await this.perfilDe(organizationId, userId, clientId);
        if (!perfil)
            return true;
        const extras = await this.extrasDe(organizationId, userId, clientId);
        return (0, shared_1.alcanza)((0, shared_1.nivelEfectivo)(perfil.areas ?? {}, extras, clave), nivel);
    }
    async perfilDe(organizationId, userId, clientId) {
        const asignacion = await this.asignaciones.findOne({ where: { organizationId, userId, clientId } });
        if (!asignacion)
            return null;
        return this.perfiles.findOne({ where: { id: asignacion.perfilId } });
    }
    async extrasDe(organizationId, userId, clientId) {
        const filas = await this.extras.find({ where: { organizationId, userId } });
        const ahora = Date.now();
        const juego = {};
        for (const fila of filas) {
            const propio = fila.clientId;
            if (propio && propio !== clientId)
                continue;
            const vence = fila.expiresAt;
            if (vence && vence.getTime() <= ahora)
                continue;
            if (!(0, shared_1.definicionDeArea)(fila.action))
                continue;
            juego[fila.action] = fila.allowed ? 'hacer' : 'ninguno';
        }
        return juego;
    }
};
exports.NivelDeAreaService = NivelDeAreaService;
exports.NivelDeAreaService = NivelDeAreaService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(perfil_asignacion_entity_1.PerfilAsignacion)),
    __param(1, (0, typeorm_1.InjectRepository)(perfil_de_empresa_entity_1.PerfilDeEmpresa)),
    __param(2, (0, typeorm_1.InjectRepository)(user_action_override_entity_1.UserActionOverride)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], NivelDeAreaService);
