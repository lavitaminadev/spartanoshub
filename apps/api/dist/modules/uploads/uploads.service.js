"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
const upload_entity_1 = require("./upload.entity");
const integration_entity_1 = require("../integrations/integration.entity");
const integration_provider_enum_1 = require("../integrations/integration-provider.enum");
const integration_secrets_1 = require("../../shared/security/integration-secrets");
const google_oauth_service_1 = require("../integrations/google/google-oauth.service");
const file_content_validator_1 = require("./file-content-validator");
let UploadsService = class UploadsService {
    constructor(repo, integrations, googleOAuth) {
        this.repo = repo;
        this.integrations = integrations;
        this.googleOAuth = googleOAuth;
        this.uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
        fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    async upload(file, organizationId, uploadedBy) {
        if (!file?.buffer?.length)
            throw new common_1.BadRequestException('Debes seleccionar un archivo válido');
        const { extension } = (0, file_content_validator_1.validateFileContent)(file.mimetype, file.buffer);
        const fileName = `${(0, uuid_1.v4)()}${extension}`;
        const filePath = path.join(this.uploadDir, fileName);
        await fs.promises.writeFile(filePath, file.buffer, { flag: 'wx' });
        try {
            const upload = this.repo.create({
                organizationId,
                fileName,
                originalName: path.basename(file.originalname).slice(0, 255),
                mimeType: file.mimetype,
                size: file.buffer.length,
                path: filePath,
                uploadedBy,
            });
            return await this.repo.save(upload);
        }
        catch (error) {
            await fs.promises.rm(filePath, { force: true });
            throw error;
        }
    }
    async getFile(id, organizationId) {
        const upload = await this.repo.findOne({ where: { id, organizationId } });
        if (!upload)
            throw new common_1.NotFoundException('File not found');
        return upload;
    }
    async delete(id, organizationId) {
        const upload = await this.getFile(id, organizationId);
        await fs.promises.rm(upload.path, { force: true });
        await this.repo.remove(upload);
    }
    async syncToDrive(id, organizationId, folderId) {
        const upload = await this.getFile(id, organizationId);
        if (upload.driveFileId)
            return upload;
        if (!fs.existsSync(upload.path))
            throw new common_1.NotFoundException('El archivo local ya no está disponible');
        let integration = await this.integrations.findOne({ where: { organizationId, provider: integration_provider_enum_1.IntegrationProvider.GOOGLE } });
        if (!integration)
            throw new common_1.BadRequestException('Google Drive no está conectado');
        const expiry = typeof integration.config?.expiryDate === 'string' ? Date.parse(integration.config.expiryDate) : Number.NaN;
        if (Number.isFinite(expiry) && expiry <= Date.now() + 60_000) {
            integration = await this.googleOAuth.refreshIntegration(integration.id, organizationId);
        }
        const token = (0, integration_secrets_1.revealSecret)(typeof integration.config?.accessToken === 'string' ? integration.config.accessToken : undefined);
        if (!token)
            throw new common_1.BadRequestException('Google Drive no está conectado');
        const boundary = `espartanos_${(0, uuid_1.v4)().replace(/-/g, '')}`;
        const metadata = JSON.stringify({ name: upload.originalName, ...(folderId ? { parents: [folderId] } : {}) });
        const file = await fs.promises.readFile(upload.path);
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
            Buffer.from(`--${boundary}\r\nContent-Type: ${upload.mimeType}\r\n\r\n`),
            file,
            Buffer.from(`\r\n--${boundary}--`),
        ]);
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${boundary}` },
            body,
            signal: AbortSignal.timeout(30_000),
        });
        const data = await response.json();
        if (!response.ok || !data.id)
            throw new common_1.BadRequestException(data.error?.message || `Google Drive upload failed (${response.status})`);
        upload.driveFileId = data.id;
        return this.repo.save(upload);
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(upload_entity_1.Upload)),
    __param(1, (0, typeorm_1.InjectRepository)(integration_entity_1.Integration)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        google_oauth_service_1.GoogleOAuthService])
], UploadsService);
