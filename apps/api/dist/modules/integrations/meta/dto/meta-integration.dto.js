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
exports.MetaAssetSelectionDto = exports.MetaPixelCredentialDto = exports.MetaClientPixelSetupDto = exports.MetaClientPixelDto = exports.MetaPixelDto = exports.MetaLeadSyncDto = exports.MetaOAuthCallbackDto = void 0;
const class_validator_1 = require("class-validator");
const META_ID = /^\d{1,32}$/;
class MetaOAuthCallbackDto {
}
exports.MetaOAuthCallbackDto = MetaOAuthCallbackDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4096),
    __metadata("design:type", String)
], MetaOAuthCallbackDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsUrl)({ require_tld: false, protocols: ['http', 'https'], require_protocol: true }),
    (0, class_validator_1.MaxLength)(2048),
    __metadata("design:type", String)
], MetaOAuthCallbackDto.prototype, "redirectUri", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4096),
    __metadata("design:type", String)
], MetaOAuthCallbackDto.prototype, "state", void 0);
class MetaLeadSyncDto {
}
exports.MetaLeadSyncDto = MetaLeadSyncDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(META_ID),
    __metadata("design:type", String)
], MetaLeadSyncDto.prototype, "pageId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(META_ID),
    __metadata("design:type", String)
], MetaLeadSyncDto.prototype, "leadgenId", void 0);
class MetaPixelDto {
}
exports.MetaPixelDto = MetaPixelDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(META_ID),
    __metadata("design:type", String)
], MetaPixelDto.prototype, "pixelId", void 0);
class MetaClientPixelDto extends MetaPixelDto {
}
exports.MetaClientPixelDto = MetaClientPixelDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MetaClientPixelDto.prototype, "clientId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], MetaClientPixelDto.prototype, "pixelName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(20),
    (0, class_validator_1.MaxLength)(4096),
    __metadata("design:type", String)
], MetaClientPixelDto.prototype, "accessToken", void 0);
class MetaClientPixelSetupDto {
}
exports.MetaClientPixelSetupDto = MetaClientPixelSetupDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MetaClientPixelSetupDto.prototype, "clientId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['none', 'manual', 'existing']),
    __metadata("design:type", String)
], MetaClientPixelSetupDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(META_ID),
    __metadata("design:type", String)
], MetaClientPixelSetupDto.prototype, "pixelId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(META_ID),
    __metadata("design:type", String)
], MetaClientPixelSetupDto.prototype, "existingPixelId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], MetaClientPixelSetupDto.prototype, "pixelName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(20),
    (0, class_validator_1.MaxLength)(4096),
    __metadata("design:type", String)
], MetaClientPixelSetupDto.prototype, "accessToken", void 0);
class MetaPixelCredentialDto {
}
exports.MetaPixelCredentialDto = MetaPixelCredentialDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(META_ID),
    __metadata("design:type", String)
], MetaPixelCredentialDto.prototype, "pixelId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], MetaPixelCredentialDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(20),
    (0, class_validator_1.MaxLength)(4096),
    __metadata("design:type", String)
], MetaPixelCredentialDto.prototype, "accessToken", void 0);
class MetaAssetSelectionDto {
}
exports.MetaAssetSelectionDto = MetaAssetSelectionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], MetaAssetSelectionDto.prototype, "pageIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], MetaAssetSelectionDto.prototype, "instagramProfileIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], MetaAssetSelectionDto.prototype, "adAccountIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], MetaAssetSelectionDto.prototype, "primaryPageId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], MetaAssetSelectionDto.prototype, "primaryInstagramProfileId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], MetaAssetSelectionDto.prototype, "primaryAdAccountId", void 0);
