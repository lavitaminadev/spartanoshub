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
var MarcaDeLaEmpresaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarcaDeLaEmpresaService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let MarcaDeLaEmpresaService = MarcaDeLaEmpresaService_1 = class MarcaDeLaEmpresaService {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(MarcaDeLaEmpresaService_1.name);
        this.vigencia = 5 * 60_000;
        this.recordadas = new Map();
    }
    async de(clientId) {
        if (!clientId)
            return undefined;
        const recordada = this.recordadas.get(clientId);
        if (recordada && recordada.vence > Date.now())
            return recordada.valor;
        try {
            const filas = await this.dataSource.query('SELECT name, logo_url FROM clients WHERE id = ? LIMIT 1', [clientId]);
            const valor = { nombre: filas[0]?.name ?? null, logo: filas[0]?.logo_url ?? null };
            this.recordadas.set(clientId, { valor, vence: Date.now() + this.vigencia });
            return valor;
        }
        catch (error) {
            this.logger.warn(`No se pudo leer la marca de ${clientId}: ${error instanceof Error ? error.message : error}`);
            return undefined;
        }
    }
    olvidar(clientId) {
        this.recordadas.delete(clientId);
    }
};
exports.MarcaDeLaEmpresaService = MarcaDeLaEmpresaService;
exports.MarcaDeLaEmpresaService = MarcaDeLaEmpresaService = MarcaDeLaEmpresaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], MarcaDeLaEmpresaService);
