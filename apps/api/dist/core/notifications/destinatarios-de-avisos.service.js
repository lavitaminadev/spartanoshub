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
exports.DestinatariosDeAvisosService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const destinatario_de_avisos_entity_1 = require("./destinatario-de-avisos.entity");
let DestinatariosDeAvisosService = class DestinatariosDeAvisosService {
    constructor(repo) {
        this.repo = repo;
    }
    async para(organizationId, clientId, tipo, heredadas = []) {
        const correos = new Set();
        for (const correo of heredadas) {
            if (typeof correo === 'string' && correo.includes('@'))
                correos.add(correo.trim().toLowerCase());
        }
        if (clientId) {
            const filas = await this.repo.find({ where: { organizationId, clientId } });
            for (const fila of filas) {
                if (fila.recibe(tipo))
                    correos.add(fila.email);
            }
        }
        return [...correos];
    }
    async listar(organizationId, clientId) {
        return this.repo.find({ where: { organizationId, clientId }, order: { createdAt: 'ASC' } });
    }
    async guardar(organizationId, clientId, datos, actor) {
        const email = datos.email?.trim().toLowerCase();
        if (!email || !email.includes('@'))
            throw new common_1.BadRequestException('Falta una dirección de correo válida');
        const tipos = this.tiposValidos(datos.tipos);
        const existente = await this.repo.findOne({ where: { organizationId, clientId, email } });
        if (existente) {
            existente.name = datos.name ?? existente.name ?? null;
            existente.cargo = datos.cargo ?? existente.cargo ?? null;
            existente.tipos = tipos;
            return this.repo.save(existente);
        }
        return this.repo.save(this.repo.create({
            organizationId, clientId, email,
            name: datos.name ?? null,
            cargo: datos.cargo ?? null,
            tipos,
            createdBy: actor ?? null,
        }));
    }
    async borrar(organizationId, clientId, id) {
        const fila = await this.repo.findOne({ where: { id, organizationId, clientId } });
        if (!fila)
            throw new common_1.NotFoundException('Esta casilla no está anotada en este local');
        await this.repo.remove(fila);
    }
    tiposValidos(tipos) {
        if (!Array.isArray(tipos))
            return [];
        return destinatario_de_avisos_entity_1.TIPOS_DE_AVISO_VALIDOS.filter((valido) => tipos.includes(valido));
    }
};
exports.DestinatariosDeAvisosService = DestinatariosDeAvisosService;
exports.DestinatariosDeAvisosService = DestinatariosDeAvisosService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(destinatario_de_avisos_entity_1.DestinatarioDeAvisos)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], DestinatariosDeAvisosService);
