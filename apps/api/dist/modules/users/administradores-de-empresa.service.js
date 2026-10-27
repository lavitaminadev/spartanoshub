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
exports.AdministradoresDeEmpresaService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../core/audit/audit.service");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_permission_override_entity_1 = require("../../core/authorization/user-permission-override.entity");
const permission_resolver_service_1 = require("../../core/authorization/permission-resolver.service");
const MODULO = 'users';
const NIVEL = 'manage';
let AdministradoresDeEmpresaService = class AdministradoresDeEmpresaService {
    constructor(overrides, permisos, auditoria) {
        this.overrides = overrides;
        this.permisos = permisos;
        this.auditoria = auditoria;
    }
    async quienesAdministran(organizationId, clientId) {
        const filas = await this.overrides.find({
            where: { organizationId, module: MODULO, level: NIVEL, clientId },
            select: { userId: true },
        });
        return filas.map((fila) => fila.userId);
    }
    async empresasQueAdministra(organizationId, userId) {
        const filas = await this.overrides.find({
            where: { organizationId, userId, module: MODULO, level: NIVEL },
            select: { clientId: true },
        });
        return filas.map((fila) => fila.clientId).filter((id) => Boolean(id));
    }
    async definir(organizationId, userId, clientId, puede, grantedBy, intervencion) {
        const existente = await this.overrides.findOne({ where: { organizationId, userId, module: MODULO, clientId } });
        if (!puede) {
            if (existente) {
                await this.asegurarQueQuedeAlguien(organizationId, userId, clientId, grantedBy, intervencion);
                await this.overrides.remove(existente);
            }
            this.permisos.invalidateUser(userId);
            return;
        }
        await this.overrides.save({
            ...(existente ?? {}),
            organizationId,
            userId,
            module: MODULO,
            clientId,
            level: NIVEL,
            reason: 'Administra el equipo de su empresa',
            expiresAt: null,
            grantedBy,
        });
        this.permisos.invalidateUser(userId);
    }
    async asegurarQueQuedeAlguien(organizationId, userId, clientId, actorId, intervencion) {
        const quedan = (await this.quienesAdministran(organizationId, clientId)).filter((id) => id !== userId);
        if (quedan.length > 0)
            return;
        const motivo = (intervencion?.motivo ?? '').trim().slice(0, 300);
        if (!intervencion?.esAgencia) {
            throw new common_1.ConflictException('Es la última persona que administra el equipo de esta empresa. Nombra primero a otra y después retira a esta.');
        }
        if (motivo.length < 3) {
            throw new common_1.BadRequestException('Es la última persona que administra el equipo de esta empresa. Escribe el motivo para retirarla: queda en auditoría.');
        }
        await this.auditoria.log({
            organizationId,
            actorId,
            entityType: 'AdministradorDeEmpresa',
            entityId: userId,
            action: 'retirar_ultimo_administrador',
            before: { clientId, administradores: [userId] },
            after: { clientId, administradores: [], motivo },
            ipAddress: intervencion.ip,
        });
    }
    async sinAdministrador(organizationId, clientId) {
        const total = await this.overrides.count({ where: { organizationId, module: MODULO, level: NIVEL, clientId } });
        return total === 0;
    }
};
exports.AdministradoresDeEmpresaService = AdministradoresDeEmpresaService;
exports.AdministradoresDeEmpresaService = AdministradoresDeEmpresaService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_permission_override_entity_1.UserPermissionOverride)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        permission_resolver_service_1.PermissionResolverService,
        audit_service_1.AuditService])
], AdministradoresDeEmpresaService);
