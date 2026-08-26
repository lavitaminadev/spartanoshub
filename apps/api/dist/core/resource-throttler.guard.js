"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceThrottlerGuard = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const node_crypto_1 = require("node:crypto");
let ResourceThrottlerGuard = class ResourceThrottlerGuard extends throttler_1.ThrottlerGuard {
    async getTracker(req) {
        const ip = req.ips?.length ? req.ips[0] : req.ip;
        const slug = req.params?.slug;
        if (slug)
            return `${ip}:${slug}`;
        const autorizacion = typeof req.headers?.authorization === 'string' ? req.headers.authorization.trim() : '';
        if (autorizacion && String(req.url ?? '').includes('/public/ingest/leads')) {
            const llave = autorizacion.toLowerCase().startsWith('bearer ') ? autorizacion.slice(7).trim() : autorizacion;
            if (llave)
                return `ingest:${(0, node_crypto_1.createHash)('sha256').update(llave).digest('hex')}`;
        }
        const correo = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        if (correo)
            return `${ip}:${correo}`;
        return String(ip);
    }
};
exports.ResourceThrottlerGuard = ResourceThrottlerGuard;
exports.ResourceThrottlerGuard = ResourceThrottlerGuard = __decorate([
    (0, common_1.Injectable)()
], ResourceThrottlerGuard);
