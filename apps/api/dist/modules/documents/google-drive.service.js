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
exports.GoogleDriveService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const client_entity_1 = require("../clients/client.entity");
const integration_entity_1 = require("../integrations/integration.entity");
const integration_provider_enum_1 = require("../integrations/integration-provider.enum");
const integration_secrets_1 = require("../../shared/security/integration-secrets");
const STANDARD_FOLDERS = ['00_BRIEF-Y-RECURSOS', '01_EDITABLES', '02_PARA-REVISION', '03_APROBADOS', '04_FINALES-ENTREGADOS'];
let GoogleDriveService = class GoogleDriveService {
    constructor(clients, integrations) {
        this.clients = clients;
        this.integrations = integrations;
    }
    async bootstrapClient(organizationId, clientId) {
        const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
        if (!client)
            throw new common_1.NotFoundException('Client not found');
        const integration = await this.integrations.findOne({ where: { organizationId, provider: integration_provider_enum_1.IntegrationProvider.GOOGLE } });
        const token = (0, integration_secrets_1.revealSecret)(typeof integration?.config?.accessToken === 'string' ? integration.config.accessToken : undefined);
        if (!token)
            throw new common_1.BadRequestException('Google Drive is not connected');
        const rootName = client.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
        const rootId = client.driveFolderId ?? await this.ensureFolder(token, rootName);
        if (!client.driveFolderId) {
            client.driveFolderId = rootId;
            await this.clients.save(client);
        }
        const folders = {};
        for (const name of STANDARD_FOLDERS)
            folders[name] = await this.ensureFolder(token, name, rootId);
        return { rootId, rootUrl: `https://drive.google.com/drive/folders/${rootId}`, folders };
    }
    async ensureFolder(token, name, parentId) {
        const escaped = name.replace(/'/g, "\\'");
        const clauses = [`name='${escaped}'`, "mimeType='application/vnd.google-apps.folder'", 'trashed=false'];
        if (parentId)
            clauses.push(`'${parentId}' in parents`);
        const query = new URLSearchParams({ q: clauses.join(' and '), fields: 'files(id,name)', pageSize: '1' });
        const found = await this.driveFetch(token, `https://www.googleapis.com/drive/v3/files?${query}`);
        if (found.files?.[0]?.id)
            return found.files[0].id;
        const created = await this.driveFetch(token, 'https://www.googleapis.com/drive/v3/files?fields=id', {
            method: 'POST',
            body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parentId ? { parents: [parentId] } : {}) }),
        });
        return created.id;
    }
    async driveFetch(token, url, init = {}) {
        const response = await fetch(url, {
            ...init,
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
            signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
            throw new common_1.BadRequestException(`Google Drive request failed (${response.status})`);
        return response.json();
    }
};
exports.GoogleDriveService = GoogleDriveService;
exports.GoogleDriveService = GoogleDriveService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(1, (0, typeorm_1.InjectRepository)(integration_entity_1.Integration)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], GoogleDriveService);
//# sourceMappingURL=google-drive.service.js.map