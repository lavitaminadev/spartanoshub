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
var MetaConversionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaConversionsService = void 0;
const common_1 = require("@nestjs/common");
const identificadores_meta_1 = require("./identificadores-meta");
const politica_meta_capi_1 = require("./politica-meta-capi");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const common_2 = require("@nestjs/common");
let MetaConversionsService = MetaConversionsService_1 = class MetaConversionsService {
    constructor(http) {
        this.http = http;
        this.logger = new common_1.Logger(MetaConversionsService_1.name);
    }
    async sendEvent(pixelId, accessToken, event) {
        const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
        const payload = {
            data: [{
                    event_name: event.eventName,
                    event_time: event.eventTime,
                    event_source_url: event.eventSourceUrl,
                    action_source: event.actionSource ?? 'system_generated',
                    user_data: {
                        em: event.userData.em,
                        ph: event.userData.ph,
                        fn: event.userData.fn,
                        ln: event.userData.ln,
                        ct: event.userData.ct,
                        st: event.userData.st,
                        country: event.userData.country,
                        external_id: event.userData.externalId,
                        lead_id: event.userData.lead_id,
                        client_ip_address: event.userData.client_ip_address,
                        client_user_agent: event.userData.client_user_agent,
                        fbc: event.userData.fbc,
                        fbp: event.userData.fbp,
                    },
                    custom_data: event.customData ? {
                        currency: event.customData.currency,
                        value: event.customData.value,
                        content_ids: event.customData.contentIds,
                        content_type: event.customData.contentType,
                        lead_event_source: event.customData.leadEventSource,
                        event_source: event.customData.eventSource,
                    } : undefined,
                    event_id: event.eventId,
                }],
            access_token: accessToken,
            ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
        };
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.http.post(`https://graph.facebook.com/${version}/${pixelId}/events`, payload, { timeout: 15000 }));
            return data;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Meta CAPI failed: ${message}`);
            if (error && typeof error === 'object' && 'response' in error) {
                const response = error.response;
                throw Object.assign(new common_2.BadGatewayException(`Meta Conversions API rejected the event: ${message}`), {
                    response: { status: response?.status, data: response?.data },
                });
            }
            throw new common_2.BadGatewayException(`Meta Conversions API rejected the event: ${message}`);
        }
    }
    async sendServerEvent(pixelId, accessToken, event) {
        const infracciones = (0, politica_meta_capi_1.revisarEvento)(event);
        if (infracciones.length > 0) {
            (0, politica_meta_capi_1.registrarBloqueo)(event.eventId, infracciones);
            throw new common_1.BadRequestException(`Meta CAPI: el evento incluye campos no autorizados (${infracciones.map((i) => `${i.seccion}.${i.campo}`).join(', ')})`);
        }
        const permitido = (0, politica_meta_capi_1.construirEventoPermitido)(event);
        const userData = (0, identificadores_meta_1.prepararIdentificadores)(permitido.userData);
        const enClaro = (0, identificadores_meta_1.parametroSinHashear)(userData);
        if (enClaro) {
            throw new common_1.BadRequestException(`Meta CAPI: el parámetro «${enClaro}» no viaja hasheado y el evento no se envía`);
        }
        this.logger.log(`META_CAPI_SENT ${(0, politica_meta_capi_1.resumenAuditable)({ ...permitido, userData })}`);
        return this.sendEvent(pixelId, accessToken, { ...permitido, userData });
    }
};
exports.MetaConversionsService = MetaConversionsService;
exports.MetaConversionsService = MetaConversionsService = MetaConversionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], MetaConversionsService);
