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
exports.UploadsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const platform_express_1 = require("@nestjs/platform-express");
const passport_1 = require("@nestjs/passport");
const class_validator_1 = require("class-validator");
const uploads_service_1 = require("./uploads.service");
const cloudinary_service_1 = require("../../core/cloudinary/cloudinary.service");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const crypto_1 = require("crypto");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
class SyncDriveDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    (0, class_validator_1.Matches)(/^[A-Za-z0-9_-]+$/),
    __metadata("design:type", String)
], SyncDriveDto.prototype, "folderId", void 0);
function toUploadResponse(upload) {
    const { path: _privatePath, ...safe } = upload;
    return safe;
}
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']);
let UploadsController = class UploadsController {
    constructor(service, cloudinary) {
        this.service = service;
        this.cloudinary = cloudinary;
    }
    async upload(file, req) {
        return toUploadResponse(await this.service.upload(file, req.organizationId, req.user.id));
    }
    async uploadImage(file, req, clientId) {
        if (!file?.buffer?.length)
            throw new common_1.BadRequestException('Debes seleccionar una imagen');
        if (!IMAGE_MIME_TYPES.has(file.mimetype))
            throw new common_1.BadRequestException('Solo se permiten imágenes JPG, PNG, GIF, WebP o AVIF');
        const maxBytes = Math.min(Number(process.env.CLOUDINARY_MAX_IMAGE_BYTES || 5 * 1024 * 1024), 10 * 1024 * 1024);
        if (file.buffer.length > maxBytes)
            throw new common_1.BadRequestException(`La imagen no puede superar los ${Math.round(maxBytes / 1024 / 1024)} MB`);
        const folder = cloudinary_service_1.CloudinaryService.folderFor(req.organizationId, clientId);
        const result = await this.cloudinary.uploadImage(file.buffer, req.organizationId, {
            folder,
            fileName: `${(0, crypto_1.randomUUID)()}-${file.originalname}`,
            tags: [`org:${req.organizationId}`, ...(clientId ? [`client:${clientId}`] : []), `user:${req.user.id}`],
            mimeType: file.mimetype,
        });
        return { url: result.secureUrl, publicId: result.publicId, width: result.width, height: result.height };
    }
    async getMetadata(id, req) {
        return toUploadResponse(await this.service.getFile(id, req.organizationId));
    }
    async syncDrive(id, dto, req) {
        return toUploadResponse(await this.service.syncToDrive(id, req.organizationId, dto.folderId));
    }
    async delete(id, req) {
        await this.service.delete(id, req.organizationId);
        return { deleted: true };
    }
    async deleteCloudinaryImage(publicId, req) {
        await this.cloudinary.destroy(decodeURIComponent(publicId), req.organizationId);
        return { deleted: true };
    }
};
exports.UploadsController = UploadsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiOperation)({ summary: 'Subir un archivo temporal seguro' }),
    (0, swagger_1.ApiBody)({ description: 'Archivo a subir (multipart/form-data)' }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)('images'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiOperation)({ summary: 'Subir una imagen a Cloudinary' }),
    (0, swagger_1.ApiBody)({ description: 'Imagen a subir (multipart/form-data). Máximo 5 MB. Formatos: jpg, png, gif, webp, avif.' }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "uploadImage", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener metadatos de un archivo' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "getMetadata", null);
__decorate([
    (0, common_1.Post)(':id/drive'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Sincronizar un archivo con Google Drive' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, SyncDriveDto, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "syncDrive", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Eliminar un archivo temporal' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "delete", null);
__decorate([
    (0, common_1.Delete)('images/cloudinary/:publicId'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL),
    (0, swagger_1.ApiOperation)({ summary: 'Eliminar una imagen de Cloudinary' }),
    __param(0, (0, common_1.Param)('publicId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "deleteCloudinaryImage", null);
exports.UploadsController = UploadsController = __decorate([
    (0, swagger_1.ApiTags)('Archivos'),
    (0, common_1.Controller)('uploads'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleExempt)('Almacenamiento transversal usado por varios modulos'),
    __metadata("design:paramtypes", [uploads_service_1.UploadsService,
        cloudinary_service_1.CloudinaryService])
], UploadsController);
//# sourceMappingURL=uploads.controller.js.map