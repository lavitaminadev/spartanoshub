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
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const node_crypto_1 = require("node:crypto");
const common_2 = require("@nestjs/common");
const geo_inference_1 = require("../../../shared/geo-inference");
const phone_1 = require("../../../shared/phone");
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
                        external_id: event.userData.externalId,
                        ct: event.userData.ct,
                        st: event.userData.st,
                        country: event.userData.country,
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
        const hashed = {
            ...event.userData,
            em: event.userData.em?.map(e => (0, node_crypto_1.createHash)('sha256').update(e.trim().toLowerCase()).digest('hex')),
            ph: event.userData.ph?.map(p => (0, node_crypto_1.createHash)('sha256').update(normalizePhoneForMeta(p)).digest('hex')),
            fn: event.userData.fn?.map(f => (0, node_crypto_1.createHash)('sha256').update(f.trim().toLowerCase()).digest('hex')),
            ln: event.userData.ln?.map(l => (0, node_crypto_1.createHash)('sha256').update(l.trim().toLowerCase()).digest('hex')),
            externalId: event.userData.externalId?.map(id => (0, node_crypto_1.createHash)('sha256').update(id).digest('hex')),
            ct: event.userData.ct?.map(c => (0, node_crypto_1.createHash)('sha256').update((0, geo_inference_1.normalizeGeoValue)(c)).digest('hex')),
            st: event.userData.st?.map(s => (0, node_crypto_1.createHash)('sha256').update((0, geo_inference_1.normalizeGeoValue)(s)).digest('hex')),
            country: event.userData.country?.map(c => (0, node_crypto_1.createHash)('sha256').update((0, geo_inference_1.normalizeGeoValue)(c)).digest('hex')),
        };
        return this.sendEvent(pixelId, accessToken, { ...event, userData: hashed });
    }
};
exports.MetaConversionsService = MetaConversionsService;
exports.MetaConversionsService = MetaConversionsService = MetaConversionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], MetaConversionsService);
function normalizePhoneForMeta(phone) {
    return (0, phone_1.normalizePhoneDigits)(phone) ?? '';
}
//# sourceMappingURL=meta-conversions.service.js.map