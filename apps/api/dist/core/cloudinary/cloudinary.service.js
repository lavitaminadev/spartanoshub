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
var CloudinaryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudinaryService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const axios_1 = require("@nestjs/axios");
const crypto_1 = require("crypto");
const rxjs_1 = require("rxjs");
const integration_entity_1 = require("../../modules/integrations/integration.entity");
const integration_provider_enum_1 = require("../../modules/integrations/integration-provider.enum");
const integration_secrets_1 = require("../../shared/security/integration-secrets");
const CLOUDINARY_FOLDER_ROOT = 'espartanos';
const CLOUDINARY_FOLDER_ROOTS = [CLOUDINARY_FOLDER_ROOT, 'vitahub'];
function toSignString(params) {
    return Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join('&');
}
function sha1(input) {
    return (0, crypto_1.createHash)('sha1').update(input).digest('hex');
}
function folderSegment(value) {
    const clean = value.replace(/[^A-Za-z0-9_-]/g, '_');
    if (!clean)
        throw new common_1.BadRequestException('Identificador de carpeta inválido');
    return clean;
}
let CloudinaryService = CloudinaryService_1 = class CloudinaryService {
    constructor(integrations, http) {
        this.integrations = integrations;
        this.http = http;
        this.logger = new common_1.Logger(CloudinaryService_1.name);
    }
    envCredentials() {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        if (cloudName && apiKey && apiSecret) {
            return { cloudName, apiKey, apiSecret };
        }
        return undefined;
    }
    async getCredentials(organizationId) {
        const env = this.envCredentials();
        if (!organizationId)
            return env;
        const integration = await this.integrations.findOne({
            where: { organizationId, provider: integration_provider_enum_1.IntegrationProvider.CLOUDINARY },
        });
        if (integration?.config?.cloudName && integration.config?.apiKey) {
            return {
                cloudName: String(integration.config.cloudName),
                apiKey: String(integration.config.apiKey),
                apiSecret: (0, integration_secrets_1.revealSecret)(integration.config.apiSecret) || env?.apiSecret || '',
            };
        }
        return env;
    }
    async isEnabled(organizationId) {
        const credentials = await this.getCredentials(organizationId);
        return Boolean(credentials?.cloudName && credentials?.apiKey && credentials?.apiSecret);
    }
    async validateCredentials(credentials) {
        try {
            await (0, rxjs_1.firstValueFrom)(this.http.get(`https://api.cloudinary.com/v1_1/${encodeURIComponent(credentials.cloudName)}/resources/image`, {
                params: { max_results: 1 },
                auth: { username: credentials.apiKey, password: credentials.apiSecret },
                timeout: 15000,
            }));
        }
        catch (error) {
            this.logger.warn('Cloudinary credential validation failed', error?.response?.data || error?.message);
            throw new common_1.BadRequestException(error?.response?.data?.error?.message || 'Cloudinary rechazó las credenciales');
        }
    }
    async uploadImage(buffer, organizationId, options = {}) {
        const credentials = await this.getCredentials(organizationId);
        if (!credentials?.cloudName || !credentials?.apiKey || !credentials?.apiSecret) {
            throw new common_1.BadRequestException('Cloudinary no está configurado para esta organización');
        }
        const folder = options.folder || 'espartanos';
        const timestamp = Math.floor(Date.now() / 1000);
        const params = { timestamp, folder, overwrite: 'true' };
        if (options.fileName) {
            const cleanName = options.fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
            params.public_id = `${folder}/${cleanName}`;
            delete params.folder;
        }
        if (options.tags?.length) {
            params.tags = options.tags.join(',');
        }
        const signature = sha1(`${toSignString(params)}${credentials.apiSecret}`);
        const form = new FormData();
        form.append('file', new Blob([new Uint8Array(buffer)], { type: options.mimeType || 'application/octet-stream' }));
        form.append('api_key', credentials.apiKey);
        form.append('timestamp', String(timestamp));
        form.append('signature', signature);
        Object.entries(params).forEach(([key, value]) => {
            if (key !== 'timestamp')
                form.append(key, String(value));
        });
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.http.post(`https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/upload`, form, { timeout: 30000 }));
            return {
                url: data.url,
                secureUrl: data.secure_url,
                publicId: data.public_id,
                format: data.format,
                bytes: data.bytes,
                width: data.width,
                height: data.height,
            };
        }
        catch (error) {
            this.logger.error('Cloudinary upload failed', error?.response?.data || error?.message);
            throw new common_1.BadRequestException(error?.response?.data?.error?.message || 'No se pudo subir la imagen a Cloudinary');
        }
    }
    async destroy(publicId, organizationId) {
        if (!this.belongsToOrganization(publicId, organizationId)) {
            throw new common_1.ForbiddenException('La imagen no pertenece a esta organización');
        }
        const credentials = await this.getCredentials(organizationId);
        if (!credentials?.cloudName || !credentials?.apiKey || !credentials?.apiSecret)
            return;
        const timestamp = Math.floor(Date.now() / 1000);
        const params = { public_id: publicId, timestamp };
        const signature = sha1(`${toSignString(params)}${credentials.apiSecret}`);
        const form = new FormData();
        form.append('public_id', publicId);
        form.append('api_key', credentials.apiKey);
        form.append('timestamp', String(timestamp));
        form.append('signature', signature);
        try {
            await (0, rxjs_1.firstValueFrom)(this.http.post(`https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/destroy`, form, { timeout: 15000 }));
        }
        catch (error) {
            this.logger.warn('Cloudinary destroy failed', error?.response?.data || error?.message);
        }
    }
    static folderFor(organizationId, clientId) {
        const root = `${CLOUDINARY_FOLDER_ROOT}/${folderSegment(organizationId)}`;
        return clientId ? `${root}/${folderSegment(clientId)}` : root;
    }
    belongsToOrganization(publicId, organizationId) {
        return CLOUDINARY_FOLDER_ROOTS.some((root) => publicId.startsWith(`${root}/${organizationId}/`));
    }
    async listResources(organizationId, options = {}) {
        const credentials = await this.getCredentials(organizationId);
        if (!credentials?.cloudName || !credentials?.apiKey || !credentials?.apiSecret) {
            throw new common_1.BadRequestException('Cloudinary no está configurado para esta organización');
        }
        try {
            const params = {
                max_results: options.maxResults || 30,
                type: 'upload',
                prefix: `${CloudinaryService_1.folderFor(organizationId, options.clientId)}/`,
            };
            if (options.nextCursor)
                params.next_cursor = options.nextCursor;
            const { data } = await (0, rxjs_1.firstValueFrom)(this.http.get(`https://api.cloudinary.com/v1_1/${encodeURIComponent(credentials.cloudName)}/resources/image`, { params, auth: { username: credentials.apiKey, password: credentials.apiSecret }, timeout: 15000 }));
            return {
                resources: (data.resources || []).map((r) => ({
                    publicId: r.public_id,
                    url: r.secure_url,
                    format: r.format,
                    bytes: r.bytes,
                    width: r.width,
                    height: r.height,
                    createdAt: r.created_at,
                })),
                nextCursor: data.next_cursor || undefined,
            };
        }
        catch (error) {
            this.logger.warn('Cloudinary list failed', error?.response?.data || error?.message);
            throw new common_1.BadRequestException(error?.response?.data?.error?.message || 'No se pudo consultar Cloudinary');
        }
    }
};
exports.CloudinaryService = CloudinaryService;
exports.CloudinaryService = CloudinaryService = CloudinaryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(integration_entity_1.Integration)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        axios_1.HttpService])
], CloudinaryService);
