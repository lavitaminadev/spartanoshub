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
exports.MetaController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const crypto_1 = require("crypto");
const meta_service_1 = require("./meta.service");
const meta_lead_ads_service_1 = require("./meta-lead-ads.service");
const meta_oauth_service_1 = require("./meta-oauth.service");
const meta_data_deletion_1 = require("./meta-data-deletion");
const public_decorator_1 = require("../../../core/auth/decorators/public.decorator");
const data_deletion_dto_1 = require("./dto/data-deletion.dto");
let MetaController = class MetaController {
    constructor(meta, metaLeadAds, oauth) {
        this.meta = meta;
        this.metaLeadAds = metaLeadAds;
        this.oauth = oauth;
    }
    async dataDeletion(body, req) {
        const appSecret = process.env.META_APP_SECRET;
        if (!appSecret || !body.signed_request) {
            throw new common_1.BadRequestException("Meta signed_request is required");
        }
        const payload = (0, meta_data_deletion_1.parseMetaSignedRequest)(body.signed_request, appSecret);
        await this.oauth.handleDataDeletion(payload.user_id);
        const confirmationCode = (0, meta_data_deletion_1.createDeletionConfirmation)(payload.user_id, appSecret);
        const publicApiUrl = process.env.API_PUBLIC_URL?.replace(/\/$/, "")
            || `${req.protocol}://${req.get("host")}/api`;
        return {
            url: `${publicApiUrl}/webhooks/meta/data-deletion/status?code=${confirmationCode}`,
            confirmation_code: confirmationCode,
        };
    }
    dataDeletionStatus(code) {
        const appSecret = process.env.META_APP_SECRET;
        if (!code || !appSecret)
            throw new common_1.BadRequestException("Invalid confirmation code");
        const confirmation = (0, meta_data_deletion_1.verifyDeletionConfirmation)(code, appSecret);
        return {
            confirmationCode: code,
            status: "completed",
            completedAt: confirmation.completedAt,
            message: "La conexion Meta y sus credenciales asociadas fueron eliminadas o desactivadas.",
        };
    }
    verify(mode, token, challenge) {
        const expected = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";
        const expectedBuf = Buffer.from(expected);
        const tokenBuf = Buffer.from(token ?? "");
        const matches = expected.length > 0 && tokenBuf.length === expectedBuf.length && (0, crypto_1.timingSafeEqual)(tokenBuf, expectedBuf);
        if (mode !== "subscribe" || !matches)
            throw new common_1.ForbiddenException();
        return challenge;
    }
    async receive(req, signature, payload) {
        this.meta.verify(req.rawBody ?? Buffer.alloc(0), signature ?? "");
        const messages = this.meta.normalize(payload);
        const replies = await this.meta.dispatch(messages);
        const leadResults = await this.metaLeadAds.processWebhook(payload);
        return { accepted: messages.length + leadResults.accepted, replies, leadResults };
    }
};
exports.MetaController = MetaController;
__decorate([
    (0, common_1.Post)("data-deletion"),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60000 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [data_deletion_dto_1.MetaDataDeletionDto, Object]),
    __metadata("design:returntype", Promise)
], MetaController.prototype, "dataDeletion", null);
__decorate([
    (0, common_1.Get)("data-deletion/status"),
    __param(0, (0, common_1.Query)("code")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MetaController.prototype, "dataDeletionStatus", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)("hub.mode")),
    __param(1, (0, common_1.Query)("hub.verify_token")),
    __param(2, (0, common_1.Query)("hub.challenge")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], MetaController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)("x-hub-signature-256")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], MetaController.prototype, "receive", null);
exports.MetaController = MetaController = __decorate([
    (0, common_1.Controller)("webhooks/meta"),
    (0, throttler_1.Throttle)({ default: { limit: 200, ttl: 60000 } }),
    (0, public_decorator_1.Public)(),
    __metadata("design:paramtypes", [meta_service_1.MetaService,
        meta_lead_ads_service_1.MetaLeadAdsService,
        meta_oauth_service_1.MetaOAuthService])
], MetaController);
//# sourceMappingURL=meta.controller.js.map