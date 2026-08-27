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
var MetaPixelService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaPixelService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const CREDENCIAL_INVALIDA = [190, 102];
let MetaPixelService = MetaPixelService_1 = class MetaPixelService {
    constructor(http) {
        this.http = http;
        this.logger = new common_1.Logger(MetaPixelService_1.name);
    }
    async verificarPixel(pixelId, accessToken) {
        const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.http.get(`https://graph.facebook.com/${version}/${pixelId}`, {
                params: { fields: 'id,name,last_fired_time' },
                headers: { authorization: `Bearer ${accessToken}` },
                timeout: 15000,
            }));
            return { verificado: !!data.id, bloquea: false };
        }
        catch (error) {
            const metaError = error
                ?.response?.data?.error;
            const motivo = metaError?.message ?? (error instanceof Error ? error.message : 'Error desconocido');
            this.logger.warn(`No se pudo verificar el Pixel ${pixelId}: ${motivo}`);
            return {
                verificado: false,
                bloquea: Boolean(metaError?.code && CREDENCIAL_INVALIDA.includes(metaError.code)),
                motivo,
            };
        }
    }
    async validatePixel(pixelId, accessToken) {
        return (await this.verificarPixel(pixelId, accessToken)).verificado;
    }
    async getPixelStats(pixelId, accessToken) {
        const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.http.get(`https://graph.facebook.com/${version}/${pixelId}/stats`, {
                headers: { authorization: `Bearer ${accessToken}` },
                timeout: 15000,
            }));
            return data;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Meta pixel stats fetch failed for ${pixelId}: ${message}`);
            return null;
        }
    }
};
exports.MetaPixelService = MetaPixelService;
exports.MetaPixelService = MetaPixelService = MetaPixelService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], MetaPixelService);
