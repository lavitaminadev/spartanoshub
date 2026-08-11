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
exports.AcceptTermsDto = exports.CompleteOnboardingDto = exports.OnboardingProfileDto = exports.TERMS_VERSION = exports.REQUIRED_CONSENTS = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
const PASSWORD_MSG = 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número';
exports.REQUIRED_CONSENTS = [
    'terms',
    'dataTreatment',
    'confidentiality',
    'properUse',
    'noDisclosure',
];
exports.TERMS_VERSION = 'v1';
class OnboardingProfileDto {
}
exports.OnboardingProfileDto = OnboardingProfileDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], OnboardingProfileDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    (0, class_validator_1.Matches)(/^\+?[\d\s-]{7,}$/, { message: 'Teléfono inválido' }),
    __metadata("design:type", String)
], OnboardingProfileDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['presential', 'hybrid', 'remote']),
    __metadata("design:type", String)
], OnboardingProfileDto.prototype, "workMode", void 0);
class CompleteOnboardingDto {
}
exports.CompleteOnboardingDto = CompleteOnboardingDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], CompleteOnboardingDto.prototype, "currentPassword", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(128),
    (0, class_validator_1.Matches)(PASSWORD_REGEX, { message: PASSWORD_MSG }),
    __metadata("design:type", String)
], CompleteOnboardingDto.prototype, "newPassword", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(exports.REQUIRED_CONSENTS.length),
    (0, class_validator_1.IsIn)(exports.REQUIRED_CONSENTS, { each: true }),
    __metadata("design:type", Array)
], CompleteOnboardingDto.prototype, "acceptedConsents", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => OnboardingProfileDto),
    __metadata("design:type", OnboardingProfileDto)
], CompleteOnboardingDto.prototype, "profile", void 0);
class AcceptTermsDto {
}
exports.AcceptTermsDto = AcceptTermsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(exports.REQUIRED_CONSENTS.length),
    (0, class_validator_1.IsIn)(exports.REQUIRED_CONSENTS, { each: true }),
    __metadata("design:type", Array)
], AcceptTermsDto.prototype, "acceptedConsents", void 0);
//# sourceMappingURL=onboarding.dto.js.map