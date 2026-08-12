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
exports.UpdateUserUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("./user.entity");
const client_entity_1 = require("../clients/client.entity");
const user_role_enum_1 = require("../organizations/user-role.enum");
const bcrypt = __importStar(require("bcryptjs"));
let UpdateUserUseCase = class UpdateUserUseCase {
    constructor(usersRepo, clientsRepo) {
        this.usersRepo = usersRepo;
        this.clientsRepo = clientsRepo;
    }
    async execute(data) {
        const user = await this.usersRepo.findOne({ where: { id: data.id, organizationId: data.organizationId } });
        if (!user)
            throw new common_1.NotFoundException('Usuario no encontrado');
        if (data.actorRole === user_role_enum_1.UserRole.OPERATIONS_DIRECTOR) {
            if ([user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR].includes(user.role)) {
                throw new common_1.ForbiddenException('No puedes administrar esta cuenta');
            }
            if (data.role && [user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR].includes(data.role)) {
                throw new common_1.ForbiddenException('No puedes asignar este nivel de acceso');
            }
        }
        if (data.actorId === user.id && (data.isActive === false || (data.role && data.role !== user.role))) {
            throw new common_1.BadRequestException('No puedes desactivar ni cambiar el rol de tu propia cuenta');
        }
        if (typeof data.name === 'string')
            user.name = data.name.trim();
        if (typeof data.email === 'string') {
            const email = data.email.trim().toLowerCase();
            const duplicate = await this.usersRepo.findOne({ where: { email } });
            if (duplicate && duplicate.id !== user.id)
                throw new common_1.ConflictException('Ya existe una cuenta con este email');
            user.email = email;
        }
        if (typeof data.phone === 'string')
            user.phone = data.phone.replace(/[^\d+]/g, '') || undefined;
        if (typeof data.isActive === 'boolean')
            user.isActive = data.isActive;
        if (data.role)
            user.role = data.role;
        if (data.password) {
            user.password = await bcrypt.hash(data.password, Number(process.env.BCRYPT_ROUNDS || 10));
            user.mustChangePassword = true;
            user.passwordChangedAt = new Date();
            user.refreshToken = null;
        }
        if (data.workMode !== undefined)
            user.workMode = data.workMode;
        if (data.weeklyCapacityUd !== undefined)
            user.weeklyCapacityUd = data.weeklyCapacityUd;
        if (data.clientId === null || data.clientId === '') {
            if (user.role === user_role_enum_1.UserRole.CLIENT)
                throw new common_1.BadRequestException('Las cuentas cliente requieren una empresa asignada');
            user.clientId = undefined;
        }
        else if (data.clientId) {
            const client = await this.clientsRepo.findOne({ where: { id: data.clientId, organizationId: data.organizationId } });
            if (!client)
                throw new common_1.BadRequestException('La empresa seleccionada no pertenece a esta organizacion');
            user.clientId = client.id;
        }
        if (user.role !== user_role_enum_1.UserRole.CLIENT) {
            user.clientId = undefined;
        }
        else if (!user.clientId) {
            throw new common_1.BadRequestException('Las cuentas cliente requieren una empresa asignada');
        }
        return this.usersRepo.save(user);
    }
};
exports.UpdateUserUseCase = UpdateUserUseCase;
exports.UpdateUserUseCase = UpdateUserUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], UpdateUserUseCase);
