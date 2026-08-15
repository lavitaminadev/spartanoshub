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
exports.ProcessCommentsService = exports.ANONYMIZED_BODY = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const process_comment_entity_1 = require("./process-comment.entity");
const user_role_enum_1 = require("../organizations/user-role.enum");
const audit_service_1 = require("../../core/audit/audit.service");
exports.ANONYMIZED_BODY = '[Contenido eliminado por política de retención]';
let ProcessCommentsService = class ProcessCommentsService {
    constructor(comments, audit) {
        this.comments = comments;
        this.audit = audit;
    }
    async list(organizationId, subjectType, subjectId, viewer) {
        const visibles = viewer.role === user_role_enum_1.UserRole.CLIENT
            ? [process_comment_entity_1.CommentVisibility.CLIENT]
            : [process_comment_entity_1.CommentVisibility.INTERNAL, process_comment_entity_1.CommentVisibility.CLIENT];
        return this.comments.find({
            where: { organizationId, subjectType, subjectId, visibility: (0, typeorm_2.In)(visibles) },
            order: { createdAt: 'ASC' },
        });
    }
    async thread(organizationId, subjectType, subjectId, viewer) {
        const todos = await this.list(organizationId, subjectType, subjectId, viewer);
        return {
            proceso: todos.filter((row) => row.visibility === process_comment_entity_1.CommentVisibility.INTERNAL),
            revision: todos.filter((row) => row.visibility === process_comment_entity_1.CommentVisibility.CLIENT),
        };
    }
    async add(organizationId, subjectType, subjectId, body, visibility, author) {
        const texto = body?.trim();
        if (!texto)
            throw new common_1.BadRequestException('El comentario no puede estar vacío');
        const alcance = author.role === user_role_enum_1.UserRole.CLIENT ? process_comment_entity_1.CommentVisibility.CLIENT : visibility;
        if (author.role === user_role_enum_1.UserRole.CLIENT && visibility === process_comment_entity_1.CommentVisibility.INTERNAL) {
            throw new common_1.ForbiddenException('Un comentario del cliente no puede ser interno');
        }
        return this.comments.save(this.comments.create({
            organizationId,
            subjectType,
            subjectId,
            body: texto,
            visibility: alcance,
            authorId: author.id,
            authorRole: author.role,
            authorName: author.name ?? null,
        }));
    }
    async edit(organizationId, id, body, author) {
        const texto = body?.trim();
        if (!texto)
            throw new common_1.BadRequestException('El comentario no puede quedar vacío');
        const comment = await this.comments.findOne({ where: { id, organizationId } });
        if (!comment)
            throw new common_1.NotFoundException('Comentario no encontrado');
        if (comment.anonymizedAt)
            throw new common_1.BadRequestException('Un comentario despersonalizado ya no se edita');
        if (comment.authorId !== author.id) {
            throw new common_1.ForbiddenException('Solo el autor edita su comentario. Agrega uno nuevo con tu corrección.');
        }
        const anterior = comment.body;
        comment.body = texto;
        comment.editedAt = new Date();
        const saved = await this.comments.save(comment);
        await this.audit.log({
            organizationId, actorId: author.id, entityType: 'process_comment', entityId: comment.id,
            action: 'edit', before: { body: anterior }, after: { body: texto },
        });
        return saved;
    }
    async anonymizeFor(subjectIds, retentionDays, reason = 'Retención cumplida') {
        if (!subjectIds.length || retentionDays <= 0)
            return 0;
        const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
        const vencidos = await this.comments.find({
            where: { subjectId: (0, typeorm_2.In)(subjectIds), createdAt: (0, typeorm_2.LessThan)(cutoff), anonymizedAt: undefined },
        });
        if (!vencidos.length)
            return 0;
        const ahora = new Date();
        for (const comment of vencidos) {
            comment.body = exports.ANONYMIZED_BODY;
            comment.authorId = null;
            comment.authorName = null;
            comment.anonymizedAt = ahora;
        }
        await this.comments.save(vencidos);
        await this.audit.log({
            organizationId: vencidos[0].organizationId, entityType: 'process_comment',
            action: 'anonymize', after: { count: vencidos.length, retentionDays }, reason,
        });
        return vencidos.length;
    }
    async countsFor(organizationId, subjectType, subjectId) {
        const rows = await this.comments.find({
            where: { organizationId, subjectType, subjectId },
            select: { visibility: true, anonymizedAt: true },
        });
        return {
            internal: rows.filter((row) => row.visibility === process_comment_entity_1.CommentVisibility.INTERNAL).length,
            client: rows.filter((row) => row.visibility === process_comment_entity_1.CommentVisibility.CLIENT).length,
            anonymized: rows.filter((row) => row.anonymizedAt).length,
        };
    }
};
exports.ProcessCommentsService = ProcessCommentsService;
exports.ProcessCommentsService = ProcessCommentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(process_comment_entity_1.ProcessComment)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        audit_service_1.AuditService])
], ProcessCommentsService);
