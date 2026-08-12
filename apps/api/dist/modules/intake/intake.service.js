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
exports.IntakeService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const work_request_entity_1 = require("./work-request.entity");
const client_entity_1 = require("../clients/client.entity");
const organization_entity_1 = require("../organizations/organization.entity");
const user_entity_1 = require("../users/user.entity");
const piece_entity_1 = require("../production/piece.entity");
const session_entity_1 = require("../audiovisual/session.entity");
const piece_status_enum_1 = require("../production/piece-status.enum");
const ud_calculator_1 = require("../design-budget/ud-calculator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const retry_on_deadlock_1 = require("../../shared/retry-on-deadlock");
const EMPTY_SCOPE = Symbol('empty-client-scope');
const ROLES_BY_AREA = {
    [work_request_entity_1.WorkRequestArea.DESIGN]: [user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.ART_DIRECTOR],
    [work_request_entity_1.WorkRequestArea.AUDIOVISUAL]: [user_role_enum_1.UserRole.AUDIOVISUAL, user_role_enum_1.UserRole.AV_DIRECTOR],
    [work_request_entity_1.WorkRequestArea.COMMUNITY]: [user_role_enum_1.UserRole.COMMUNITY_MANAGER],
};
const AREA_LABELS = {
    [work_request_entity_1.WorkRequestArea.DESIGN]: 'diseño',
    [work_request_entity_1.WorkRequestArea.AUDIOVISUAL]: 'audiovisual',
    [work_request_entity_1.WorkRequestArea.COMMUNITY]: 'community',
};
const TRANSITIONS = {
    [work_request_entity_1.WorkRequestStatus.NEW]: [work_request_entity_1.WorkRequestStatus.IN_REVIEW, work_request_entity_1.WorkRequestStatus.REJECTED],
    [work_request_entity_1.WorkRequestStatus.IN_REVIEW]: [work_request_entity_1.WorkRequestStatus.ACCEPTED, work_request_entity_1.WorkRequestStatus.REJECTED],
    [work_request_entity_1.WorkRequestStatus.ACCEPTED]: [work_request_entity_1.WorkRequestStatus.CONVERTED, work_request_entity_1.WorkRequestStatus.REJECTED],
    [work_request_entity_1.WorkRequestStatus.CONVERTED]: [],
    [work_request_entity_1.WorkRequestStatus.REJECTED]: [],
};
let IntakeService = class IntakeService {
    constructor(requests, clients, users, dataSource) {
        this.requests = requests;
        this.clients = clients;
        this.users = users;
        this.dataSource = dataSource;
    }
    async create(organizationId, requestedBy, dto, allowedClientIds) {
        await this.assertClient(organizationId, dto.clientId, allowedClientIds);
        return (0, retry_on_deadlock_1.retryOnDeadlock)('crear solicitud', () => this.dataSource.transaction(async (manager) => {
            await manager.getRepository(organization_entity_1.Organization)
                .createQueryBuilder('o')
                .setLock('pessimistic_write')
                .where('o.id = :organizationId', { organizationId })
                .getOne();
            const [last] = await manager.getRepository(work_request_entity_1.WorkRequest).find({
                where: { organizationId },
                order: { code: 'DESC' },
                select: { id: true, code: true },
                take: 1,
            });
            const nextNumber = last?.code ? Number(last.code.replace(/\D/g, '')) + 1 : 1;
            const request = manager.create(work_request_entity_1.WorkRequest, {
                ...dto,
                organizationId,
                requestedBy,
                code: `SOL-${String(nextNumber).padStart(5, '0')}`,
                status: work_request_entity_1.WorkRequestStatus.NEW,
                neededBy: dto.neededBy ? new Date(dto.neededBy) : null,
            });
            return manager.save(work_request_entity_1.WorkRequest, request);
        }));
    }
    async list(organizationId, filters, allowedClientIds) {
        const scope = this.clientScope(filters.clientId, allowedClientIds);
        if (scope === EMPTY_SCOPE)
            return { data: [], total: 0 };
        const where = { organizationId };
        if (scope !== undefined)
            where.clientId = scope;
        if (filters.status)
            where.status = filters.status;
        if (filters.area)
            where.area = filters.area;
        if (filters.mine)
            where.assignedTo = filters.mine;
        const [data, total] = await this.requests.findAndCount({
            where,
            relations: ['client', 'requester', 'assignee'],
            order: { createdAt: 'DESC' },
            take: 200,
        });
        return { data, total };
    }
    async findOne(organizationId, id, allowedClientIds) {
        const request = await this.requests.findOne({ where: { id, organizationId }, relations: ['client', 'requester', 'assignee'] });
        if (!request)
            throw new common_1.NotFoundException('Solicitud no encontrada');
        if (allowedClientIds !== undefined && !allowedClientIds.includes(request.clientId)) {
            throw new common_1.NotFoundException('Solicitud no encontrada');
        }
        return request;
    }
    async update(organizationId, id, dto, allowedClientIds) {
        const request = await this.findOne(organizationId, id, allowedClientIds);
        if (dto.status && dto.status !== request.status) {
            const allowed = TRANSITIONS[request.status] ?? [];
            if (!allowed.includes(dto.status)) {
                throw new common_1.ConflictException(`No se puede pasar de ${request.status} a ${dto.status}`);
            }
            if (dto.status === work_request_entity_1.WorkRequestStatus.REJECTED && !dto.rejectionReason?.trim()) {
                throw new common_1.BadRequestException('Indica por qué se rechaza');
            }
            request.status = dto.status;
            if (dto.status === work_request_entity_1.WorkRequestStatus.IN_REVIEW)
                request.reviewedAt = new Date();
            if (dto.status === work_request_entity_1.WorkRequestStatus.REJECTED)
                request.resolvedAt = new Date();
        }
        if (dto.assignedTo !== undefined) {
            if (dto.assignedTo) {
                const assignee = await this.users.findOne({ where: { id: dto.assignedTo, organizationId, isActive: true }, select: { id: true, role: true } });
                if (!assignee)
                    throw new common_1.BadRequestException('El responsable no es un usuario activo de la organización');
                if (!ROLES_BY_AREA[request.area].includes(assignee.role)) {
                    throw new common_1.BadRequestException(`El responsable no pertenece al área de ${AREA_LABELS[request.area]}`);
                }
            }
            request.assignedTo = dto.assignedTo || null;
        }
        if (dto.priority)
            request.priority = dto.priority;
        if (dto.rejectionReason !== undefined)
            request.rejectionReason = dto.rejectionReason?.trim() || null;
        if (dto.operationalFields !== undefined)
            request.operationalFields = dto.operationalFields;
        return this.requests.save(request);
    }
    async convert(organizationId, id, dto, allowedClientIds) {
        const request = await this.findOne(organizationId, id, allowedClientIds);
        if (request.status !== work_request_entity_1.WorkRequestStatus.ACCEPTED) {
            throw new common_1.ConflictException('Solo una solicitud aceptada se puede convertir');
        }
        if (request.area === work_request_entity_1.WorkRequestArea.DESIGN)
            return this.convertToPieces(organizationId, request, dto);
        if (request.area === work_request_entity_1.WorkRequestArea.AUDIOVISUAL)
            return this.convertToSession(organizationId, request, dto);
        throw new common_1.ConflictException('Una solicitud de community todavía no se convierte: falta definir su destino en la parrilla de contenido');
    }
    async convertToPieces(organizationId, request, dto) {
        if (dto.session)
            throw new common_1.BadRequestException('Una solicitud de diseño no agenda una sesión');
        if (!dto.pieces?.length)
            throw new common_1.BadRequestException('Indica al menos una pieza');
        const pieces = dto.pieces;
        return (0, retry_on_deadlock_1.retryOnDeadlock)('convertir solicitud en piezas', () => this.dataSource.transaction(async (manager) => {
            const created = await manager.save(piece_entity_1.Piece, pieces.map((piece) => manager.create(piece_entity_1.Piece, {
                organizationId,
                clientId: request.clientId,
                title: piece.title.trim(),
                type: piece.type,
                status: piece_status_enum_1.PieceStatus.BACKLOG,
                difficultyLevel: piece.difficultyLevel ?? 1,
                udAmount: (0, ud_calculator_1.calculatePieceUd)(piece.type, piece.carouselSlides),
                description: request.description ?? undefined,
                assignedTo: request.assignedTo ?? undefined,
                deadlineAt: request.neededBy ?? undefined,
            })));
            request.status = work_request_entity_1.WorkRequestStatus.CONVERTED;
            request.resolvedAt = new Date();
            request.pieceIds = created.map((piece) => piece.id);
            return manager.save(work_request_entity_1.WorkRequest, request);
        }));
    }
    async convertToSession(organizationId, request, dto) {
        if (dto.pieces?.length)
            throw new common_1.BadRequestException('Una solicitud audiovisual no crea piezas gráficas');
        if (!dto.session)
            throw new common_1.BadRequestException('Indica el tipo, la fecha y la locación de la sesión');
        const { session } = dto;
        const team = [...new Set([...(session.assignedTeam ?? []), ...(request.assignedTo ? [request.assignedTo] : [])])];
        await this.assertActiveUsers(organizationId, team);
        return (0, retry_on_deadlock_1.retryOnDeadlock)('convertir solicitud en sesión', () => this.dataSource.transaction(async (manager) => {
            const created = await manager.save(session_entity_1.Session, manager.create(session_entity_1.Session, {
                organizationId,
                clientId: request.clientId,
                type: session.type,
                date: new Date(session.date),
                location: session.location?.trim() || undefined,
                assignedTeam: team.length ? team : undefined,
                moodboardId: session.moodboardId,
                status: 'scheduled',
            }));
            request.status = work_request_entity_1.WorkRequestStatus.CONVERTED;
            request.resolvedAt = new Date();
            request.sessionId = created.id;
            return manager.save(work_request_entity_1.WorkRequest, request);
        }));
    }
    async assertActiveUsers(organizationId, userIds) {
        if (!userIds.length)
            return;
        const found = await this.users.count({ where: { id: (0, typeorm_2.In)(userIds), organizationId, isActive: true } });
        if (found !== userIds.length)
            throw new common_1.BadRequestException('El equipo asignado contiene usuarios inválidos');
    }
    async assigneeOptions(organizationId, area) {
        return this.users.find({
            select: { id: true, name: true, role: true, weeklyCapacityUd: true },
            where: { organizationId, isActive: true, role: (0, typeorm_2.In)(ROLES_BY_AREA[area]) },
            order: { name: 'ASC' },
        });
    }
    async counts(organizationId, allowedClientIds) {
        if (allowedClientIds?.length === 0)
            return {};
        const where = { organizationId };
        if (allowedClientIds)
            where.clientId = (0, typeorm_2.In)(allowedClientIds);
        const rows = await this.requests.createQueryBuilder('r')
            .select('r.status', 'status').addSelect('COUNT(*)', 'total')
            .where(where)
            .groupBy('r.status')
            .getRawMany();
        return Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]));
    }
    async assertClient(organizationId, clientId, allowedClientIds) {
        const client = await this.clients.findOne({ where: { id: clientId, organizationId }, select: { id: true } });
        if (!client)
            throw new common_1.BadRequestException('La cuenta no pertenece a esta organización');
        if (allowedClientIds !== undefined && !allowedClientIds.includes(clientId)) {
            throw new common_1.NotFoundException('Cuenta no encontrada');
        }
    }
    clientScope(clientId, allowedClientIds) {
        if (allowedClientIds === undefined)
            return clientId;
        if (allowedClientIds.length === 0)
            return EMPTY_SCOPE;
        if (clientId)
            return allowedClientIds.includes(clientId) ? clientId : EMPTY_SCOPE;
        return (0, typeorm_2.In)(allowedClientIds);
    }
};
exports.IntakeService = IntakeService;
exports.IntakeService = IntakeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(work_request_entity_1.WorkRequest)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], IntakeService);
//# sourceMappingURL=intake.service.js.map