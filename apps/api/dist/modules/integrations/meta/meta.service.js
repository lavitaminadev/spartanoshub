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
exports.MetaService = void 0;
exports.verifyMetaSignature = verifyMetaSignature;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const node_crypto_1 = require("node:crypto");
const rxjs_1 = require("rxjs");
function verifyMetaSignature(rawBody, signature, secret) {
    if (!signature.startsWith("sha256="))
        return false;
    const expected = Buffer.from((0, node_crypto_1.createHmac)("sha256", secret).update(rawBody).digest("hex"), "utf8");
    const received = Buffer.from(signature.slice(7), "utf8");
    return expected.length === received.length && (0, node_crypto_1.timingSafeEqual)(expected, received);
}
let MetaService = class MetaService {
    constructor(http) {
        this.http = http;
    }
    verify(rawBody, signature) {
        const secret = process.env.META_APP_SECRET;
        if (!secret || !verifyMetaSignature(rawBody, signature, secret))
            throw new common_1.UnauthorizedException("Invalid Meta signature");
    }
    normalize(payload) {
        const result = [];
        for (const entry of payload.entry ?? []) {
            for (const item of entry.messaging ?? []) {
                if (item.message) {
                    const tenantId = process.env[`META_TENANT_${entry.id}`] ?? process.env.DEFAULT_TENANT_ID;
                    if (!tenantId)
                        continue;
                    result.push({
                        eventId: item.message.mid,
                        providerMessageId: item.message.mid,
                        tenantId,
                        channel: "instagram",
                        channelAccountId: entry.id,
                        externalUserId: item.sender.id,
                        text: item.message.text,
                        attachments: (item.message.attachments ?? []).map((a) => ({
                            type: ["image", "video", "audio", "file"].includes(a.type) ? a.type : "unknown",
                            url: a.payload?.url,
                        })),
                        occurredAt: new Date(item.timestamp).toISOString(),
                    });
                }
            }
        }
        return result;
    }
    async dispatch(messages) {
        const baseUrl = process.env.CONVERSATION_SERVICE_URL?.replace(/\/$/, '');
        if (!baseUrl) {
            return messages.map(() => ({ skipped: true, reason: 'conversation_service_not_configured' }));
        }
        return Promise.all(messages.map(async (message) => {
            const headers = { "content-type": "application/json" };
            if (process.env.INTERNAL_API_TOKEN)
                headers["x-internal-token"] = process.env.INTERNAL_API_TOKEN;
            const reply = (await (0, rxjs_1.firstValueFrom)(this.http.post(`${baseUrl}/internal/messages/inbound`, message, { headers }))).data;
            if (reply.text)
                await this.sendInstagramText(message.channelAccountId, message.externalUserId, reply.text);
            return reply;
        }));
    }
    async sendInstagramText(accountId, recipientId, text) {
        const token = process.env[`META_TOKEN_${accountId}`] ?? process.env.META_PAGE_ACCESS_TOKEN;
        if (!token)
            return { skipped: true, reason: "missing_page_token" };
        const version = process.env.META_GRAPH_API_VERSION ?? "v23.0";
        const { data } = await (0, rxjs_1.firstValueFrom)(this.http.post(`https://graph.facebook.com/${version}/${accountId}/messages`, { recipient: { id: recipientId }, message: { text } }, { headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } }));
        return data;
    }
    async refreshToken(accountId) {
        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;
        const currentToken = process.env[`META_TOKEN_${accountId}`] ?? process.env.META_PAGE_ACCESS_TOKEN;
        if (!appId || !appSecret || !currentToken)
            return false;
        try {
            const version = process.env.META_GRAPH_API_VERSION ?? "v23.0";
            const { data } = await (0, rxjs_1.firstValueFrom)(this.http.get(`https://graph.facebook.com/${version}/oauth/access_token`, {
                params: {
                    grant_type: "fb_exchange_token",
                    client_id: appId,
                    client_secret: appSecret,
                    fb_exchange_token: currentToken,
                },
            }));
            return !!data.access_token;
        }
        catch {
            return false;
        }
    }
};
exports.MetaService = MetaService;
exports.MetaService = MetaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], MetaService);
//# sourceMappingURL=meta.service.js.map