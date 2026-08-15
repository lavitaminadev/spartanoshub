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
exports.PieceTypesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const piece_type_definition_entity_1 = require("./piece-type-definition.entity");
const user_role_enum_1 = require("../organizations/user-role.enum");
const piece_type_enum_1 = require("./piece-type.enum");
const parameter_resolver_service_1 = require("../../core/parameters/parameter-resolver.service");
const audit_service_1 = require("../../core/audit/audit.service");
const ALWAYS_APPROVE = new Set([user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR]);
const PROPOSE_ROLES = {
    [piece_type_definition_entity_1.PieceTypeArea.DESIGN]: [user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.ART_DIRECTOR],
    [piece_type_definition_entity_1.PieceTypeArea.AUDIOVISUAL]: [user_role_enum_1.UserRole.AUDIOVISUAL, user_role_enum_1.UserRole.AV_DIRECTOR],
};
function toKey(label) {
    return label.trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 50);
}
let PieceTypesService = class PieceTypesService {
    constructor(types, parameters, audit) {
        this.types = types;
        this.parameters = parameters;
        this.audit = audit;
    }
    async list(organizationId, viewer, filters = {}) {
        const estados = filters.includeInactive && (await this.canApprove(organizationId, viewer.role))
            ? [piece_type_definition_entity_1.PieceTypeStatus.DRAFT, piece_type_definition_entity_1.PieceTypeStatus.PENDING_APPROVAL, piece_type_definition_entity_1.PieceTypeStatus.ACTIVE, piece_type_definition_entity_1.PieceTypeStatus.RETIRED]
            : [piece_type_definition_entity_1.PieceTypeStatus.ACTIVE];
        return this.types.find({
            where: {
                organizationId,
                status: (0, typeorm_2.In)(estados),
                ...(filters.area ? { area: filters.area } : {}),
            },
            order: { area: 'ASC', label: 'ASC' },
        });
    }
    async activeFor(organizationId, area) {
        return this.types.find({
            where: { organizationId, area, status: piece_type_definition_entity_1.PieceTypeStatus.ACTIVE },
            order: { label: 'ASC' },
        });
    }
    async propose(organizationId, dto, requestedBy, role) {
        const area = dto.area ?? piece_type_definition_entity_1.PieceTypeArea.DESIGN;
        const puedeProponer = ALWAYS_APPROVE.has(role) || PROPOSE_ROLES[area].includes(role);
        if (!puedeProponer) {
            throw new common_1.ForbiddenException(`Un tipo de pieza de ${area} lo propone quien trabaja en esa área o la dirección`);
        }
        const key = dto.key ? toKey(dto.key) : toKey(dto.label);
        if (!key)
            throw new common_1.BadRequestException('El nombre del tipo debe tener al menos una letra o número');
        const existing = await this.types.findOne({ where: { organizationId, key } });
        if (existing) {
            throw new common_1.BadRequestException(`Ya existe un tipo con el identificador «${key}» (${existing.label}, ${existing.status})`);
        }
        const propuesto = await this.types.save(this.types.create({
            organizationId,
            key,
            label: dto.label.trim(),
            area,
            udAmount: dto.udAmount ?? null,
            extraPerUnit: dto.extraPerUnit ?? null,
            xpWeight: dto.xpWeight ?? 1,
            isPrint: dto.isPrint ?? false,
            status: piece_type_definition_entity_1.PieceTypeStatus.PENDING_APPROVAL,
            requestedBy,
            notes: dto.notes?.trim(),
        }));
        await this.audit.log({
            organizationId, actorId: requestedBy, entityType: 'piece_type', entityId: propuesto.id,
            action: 'propose', after: this.snapshot(propuesto), reason: dto.notes?.trim(),
        });
        return propuesto;
    }
    async approve(organizationId, id, role, approvedBy, ajustes) {
        if (!(await this.canApprove(organizationId, role))) {
            throw new common_1.ForbiddenException('Tu cargo no tiene la atribución de aprobar tipos de pieza');
        }
        const type = await this.find(organizationId, id);
        if (type.status === piece_type_definition_entity_1.PieceTypeStatus.ACTIVE)
            return type;
        const before = this.snapshot(type);
        if (ajustes)
            this.applyEdits(type, ajustes);
        type.status = piece_type_definition_entity_1.PieceTypeStatus.ACTIVE;
        type.approvedBy = approvedBy;
        type.approvedAt = new Date();
        const saved = await this.types.save(type);
        await this.audit.log({
            organizationId, actorId: approvedBy, entityType: 'piece_type', entityId: type.id,
            action: 'approve', before, after: this.snapshot(saved),
            reason: `Aprobado por ${role}`,
        });
        return saved;
    }
    async update(organizationId, id, role, dto) {
        if (!(await this.canApprove(organizationId, role))) {
            throw new common_1.ForbiddenException('Tu cargo no tiene la atribución de editar el catálogo de tipos');
        }
        const type = await this.find(organizationId, id);
        const before = this.snapshot(type);
        this.applyEdits(type, dto);
        const saved = await this.types.save(type);
        await this.audit.log({
            organizationId, entityType: 'piece_type', entityId: type.id,
            action: 'update', before, after: this.snapshot(saved), reason: `Editado por ${role}`,
        });
        return saved;
    }
    async retire(organizationId, id, role, reason) {
        if (!(await this.canApprove(organizationId, role))) {
            throw new common_1.ForbiddenException('Tu cargo no tiene la atribución de retirar tipos de pieza');
        }
        const type = await this.find(organizationId, id);
        const before = this.snapshot(type);
        type.status = piece_type_definition_entity_1.PieceTypeStatus.RETIRED;
        if (reason)
            type.notes = reason.slice(0, 500);
        const saved = await this.types.save(type);
        await this.audit.log({
            organizationId, entityType: 'piece_type', entityId: type.id,
            action: 'retire', before, after: this.snapshot(saved), reason,
        });
        return saved;
    }
    async assertUsable(organizationId, keys) {
        const pedidos = [...new Set(keys)];
        if (!pedidos.length)
            return;
        const encontrados = await this.types.find({
            where: { organizationId, key: (0, typeorm_2.In)(pedidos), status: piece_type_definition_entity_1.PieceTypeStatus.ACTIVE },
            select: { key: true },
        });
        const activos = new Set(encontrados.map((type) => type.key));
        const delMaestro = new Set(Object.values(piece_type_enum_1.PieceType));
        const invalidos = pedidos.filter((key) => !activos.has(key) && !delMaestro.has(key));
        if (invalidos.length) {
            throw new common_1.BadRequestException(`Estos tipos de pieza no están activos en el catálogo: ${invalidos.join(', ')}. Propónlos y espera su aprobación antes de usarlos.`);
        }
    }
    async canApprove(organizationId, role) {
        if (ALWAYS_APPROVE.has(role))
            return true;
        const configurado = await this.parameters.get('production.piece_type_approver_role', null, null, organizationId);
        return typeof configurado === 'string' && configurado === role;
    }
    snapshot(type) {
        return {
            key: type.key, label: type.label, area: type.area, status: type.status,
            udAmount: type.udAmount, extraPerUnit: type.extraPerUnit, xpWeight: type.xpWeight, isPrint: type.isPrint,
        };
    }
    applyEdits(type, dto) {
        if (dto.label !== undefined)
            type.label = dto.label.trim();
        if (dto.udAmount !== undefined)
            type.udAmount = dto.udAmount;
        if (dto.extraPerUnit !== undefined)
            type.extraPerUnit = dto.extraPerUnit;
        if (dto.xpWeight !== undefined)
            type.xpWeight = dto.xpWeight;
        if (dto.isPrint !== undefined)
            type.isPrint = dto.isPrint;
        if (dto.notes !== undefined)
            type.notes = dto.notes.trim().slice(0, 500);
    }
    async find(organizationId, id) {
        const type = await this.types.findOne({ where: { id, organizationId } });
        if (!type)
            throw new common_1.NotFoundException('Tipo de pieza no encontrado');
        return type;
    }
};
exports.PieceTypesService = PieceTypesService;
exports.PieceTypesService = PieceTypesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(piece_type_definition_entity_1.PieceTypeDefinition)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        parameter_resolver_service_1.ParameterResolver,
        audit_service_1.AuditService])
], PieceTypesService);
