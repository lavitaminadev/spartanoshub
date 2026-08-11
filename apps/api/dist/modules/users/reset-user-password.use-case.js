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
exports.ResetUserPasswordUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const bcrypt = __importStar(require("bcryptjs"));
const user_entity_1 = require("./user.entity");
const user_role_enum_1 = require("../organizations/user-role.enum");
const email_service_1 = require("../../core/notifications/email.service");
let ResetUserPasswordUseCase = class ResetUserPasswordUseCase {
    constructor(users, email) {
        this.users = users;
        this.email = email;
    }
    async execute(params) {
        const user = await this.users.findOne({ where: { id: params.id, organizationId: params.organizationId } });
        if (!user)
            throw new common_1.NotFoundException('Usuario no encontrado');
        if (params.actorRole === user_role_enum_1.UserRole.OPERATIONS_DIRECTOR && [user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR].includes(user.role)) {
            throw new common_1.ForbiddenException('No puedes resetear esta cuenta');
        }
        const temporaryPassword = (0, crypto_1.randomBytes)(18).toString('base64url');
        user.password = await bcrypt.hash(temporaryPassword, Number(process.env.BCRYPT_ROUNDS || 10));
        user.mustChangePassword = true;
        user.passwordChangedAt = new Date();
        user.refreshToken = null;
        await this.users.save(user);
        const appUrl = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
        const emailSent = params.sendEmail !== false && await this.email.sendTemporaryPassword(user.name, user.email, temporaryPassword, `${appUrl}/login`);
        return { userId: user.id, temporaryPassword, emailSent, mustChangePassword: true };
    }
};
exports.ResetUserPasswordUseCase = ResetUserPasswordUseCase;
exports.ResetUserPasswordUseCase = ResetUserPasswordUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        email_service_1.EmailService])
], ResetUserPasswordUseCase);
//# sourceMappingURL=reset-user-password.use-case.js.map