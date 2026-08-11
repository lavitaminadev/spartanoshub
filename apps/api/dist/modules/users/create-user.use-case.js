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
exports.CreateUserUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = __importStar(require("bcryptjs"));
const user_entity_1 = require("./user.entity");
const user_role_enum_1 = require("../organizations/user-role.enum");
const client_entity_1 = require("../clients/client.entity");
let CreateUserUseCase = class CreateUserUseCase {
    constructor(repo, clientsRepo) {
        this.repo = repo;
        this.clientsRepo = clientsRepo;
    }
    async execute(data) {
        const normalizedRole = data.role || user_role_enum_1.UserRole.DESIGNER;
        const normalizedEmail = data.email.trim().toLowerCase();
        const normalizedName = data.name.trim();
        const normalizedPhone = data.phone?.replace(/[^\d+]/g, '');
        if (data.actorRole === user_role_enum_1.UserRole.OPERATIONS_DIRECTOR && [user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR].includes(normalizedRole)) {
            throw new common_1.ForbiddenException('Operations directors cannot create administrators or operations directors');
        }
        const existing = await this.repo.findOne({ where: { email: normalizedEmail } });
        if (existing)
            throw new common_1.ConflictException('Ya existe una cuenta con este email');
        const clientId = await this.resolveClientId(data.organizationId, normalizedRole, data.clientId);
        const hashed = await bcrypt.hash(data.password, Number(process.env.BCRYPT_ROUNDS || 10));
        const user = this.repo.create({
            email: normalizedEmail,
            password: hashed,
            name: normalizedName,
            organizationId: data.organizationId,
            role: normalizedRole,
            phone: normalizedPhone,
            clientId,
            workMode: data.workMode,
            weeklyCapacityUd: data.weeklyCapacityUd ?? 20,
            invitedAt: new Date(),
            mustChangePassword: true,
            mustCompleteProfile: true,
        });
        return this.repo.save(user);
    }
    async resolveClientId(organizationId, role, clientId) {
        if (role !== user_role_enum_1.UserRole.CLIENT)
            return undefined;
        if (!clientId)
            throw new common_1.BadRequestException('Las cuentas cliente requieren una empresa asignada');
        const client = await this.clientsRepo.findOne({ where: { id: clientId, organizationId } });
        if (!client)
            throw new common_1.BadRequestException('La empresa seleccionada no pertenece a esta organizacion');
        return client.id;
    }
};
exports.CreateUserUseCase = CreateUserUseCase;
exports.CreateUserUseCase = CreateUserUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], CreateUserUseCase);
//# sourceMappingURL=create-user.use-case.js.map