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
var AuditInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const audit_service_1 = require("./audit.service");
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE = /password|token|secret|authorization|cookie|credential|temporary/i;
const CONTAINER_SEGMENTS = new Set(['crm', 'billing', 'production', 'integrations', 'public']);
let AuditInterceptor = AuditInterceptor_1 = class AuditInterceptor {
    constructor(audit) {
        this.audit = audit;
        this.logger = new common_1.Logger(AuditInterceptor_1.name);
    }
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        if (!MUTATING.has(request.method) || !request.organizationId || !request.user?.id)
            return next.handle();
        const path = (request.originalUrl ?? request.url ?? '').split('?')[0].replace(/^\/api\/?/, '');
        const segments = path.split('/').filter(Boolean);
        const entityType = this.entityType(segments);
        const action = this.action(request.method, segments);
        const requestedId = request.params?.id ?? request.params?.pieceId ?? request.params?.gridId ?? request.params?.actionItemId;
        return next.handle().pipe((0, rxjs_1.tap)((response) => {
            const responseId = response && typeof response === 'object' && 'id' in response ? String(response.id ?? '') : '';
            const entityId = UUID.test(requestedId ?? '') ? requestedId : UUID.test(responseId) ? responseId : null;
            void this.audit.log({
                organizationId: request.organizationId, actorId: request.user.id, entityType, entityId,
                action, after: this.sanitize(request.body), reason: `request:${request.method.toLowerCase()}:${path}`,
                ipAddress: request.ip ?? request.socket?.remoteAddress,
            }).catch((error) => {
                this.logger.error(`Fallo al registrar auditoria para ${request.method} ${path}: ${error instanceof Error ? error.message : error}`);
            });
        }));
    }
    entityType(segments) {
        const [first, second] = segments;
        if (!first)
            return 'operation';
        if (CONTAINER_SEGMENTS.has(first) && second && !UUID.test(second)) {
            return `${first}_${second}`.replace(/-/g, '_').slice(0, 50);
        }
        return first;
    }
    action(method, segments) {
        const last = segments.at(-1);
        if (last && !UUID.test(last) && !/^\d+$/.test(last) && !['users', 'clients', 'meetings', 'contracts', 'catalog', 'reporting', 'production', 'content'].includes(last))
            return last.replace(/-/g, '_').slice(0, 50);
        return { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' }[method] ?? 'change';
    }
    sanitize(value, depth = 0) {
        if (depth > 3 || value == null)
            return value;
        if (Array.isArray(value))
            return value.slice(0, 50).map((item) => this.sanitize(item, depth + 1));
        if (typeof value !== 'object')
            return typeof value === 'string' && value.length > 2000 ? `${value.slice(0, 2000)}...` : value;
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE.test(key) ? '[REDACTED]' : this.sanitize(item, depth + 1)]));
    }
};
exports.AuditInterceptor = AuditInterceptor;
exports.AuditInterceptor = AuditInterceptor = AuditInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [audit_service_1.AuditService])
], AuditInterceptor);
