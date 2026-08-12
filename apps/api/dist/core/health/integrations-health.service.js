"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationsHealthService = void 0;
const common_1 = require("@nestjs/common");
let IntegrationsHealthService = class IntegrationsHealthService {
    async checkMeta() {
        return { status: process.env.META_APP_ID ? 'configured' : 'not_configured', configured: !!process.env.META_APP_ID };
    }
    async checkGoogle() {
        return { status: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not_configured', configured: !!process.env.GOOGLE_CLIENT_ID };
    }
    async checkAll() {
        const [meta, google] = await Promise.all([this.checkMeta(), this.checkGoogle()]);
        return { meta, google };
    }
};
exports.IntegrationsHealthService = IntegrationsHealthService;
exports.IntegrationsHealthService = IntegrationsHealthService = __decorate([
    (0, common_1.Injectable)()
], IntegrationsHealthService);
