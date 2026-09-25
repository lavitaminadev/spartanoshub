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
exports.OrganizationSettingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../authorization/roles.decorator");
const throttler_1 = require("@nestjs/throttler");
const account_access_service_1 = require("../client-scope/account-access.service");
const email_service_1 = require("../notifications/email.service");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../../modules/users/user.entity");
const plantilla_de_correo_1 = require("../notifications/plantilla-de-correo");
const muestra_de_correo_1 = require("./muestra-de-correo");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const update_organization_settings_dto_1 = require("./dto/update-organization-settings.dto");
const organization_settings_service_1 = require("./organization-settings.service");
const module_scope_decorator_1 = require("../authorization/module-scope.decorator");
const permission_resolver_service_1 = require("../authorization/permission-resolver.service");
const client_capability_service_1 = require("../client-scope/client-capability.service");
const requires_permission_decorator_1 = require("../authorization/requires-permission.decorator");
const cron_run_entity_1 = require("../cron/cron-run.entity");
const requisitos_de_correo_1 = require("./requisitos-de-correo");
const ES_CLAVE_DE_CORREO = (clave) => clave.startsWith('email.');
const MODULO_DE_CORREO = [
    ['email.post_visit_survey', 'surveys'],
    ['email.survey', 'surveys'],
    ['email.lead', 'crm'],
    ['email.crm', 'crm'],
];
function moduloDeCorreo(clave) {
    return MODULO_DE_CORREO.find(([prefijo]) => clave.startsWith(prefijo))?.[1] ?? 'reservations';
}
const organization_features_1 = require("../../modules/organizations/organization-features");
const shared_1 = require("@espartanos/shared");
let OrganizationSettingsController = class OrganizationSettingsController {
    constructor(settings, permisos, accountAccess, capacidades, correo, usuarios, corridas) {
        this.settings = settings;
        this.permisos = permisos;
        this.accountAccess = accountAccess;
        this.capacidades = capacidades;
        this.correo = correo;
        this.usuarios = usuarios;
        this.corridas = corridas;
    }
    async list(request, clientId) {
        const organizationId = request.organizationId || request.user.organizationId;
        await this.accountAccess.assertClient(organizationId, request.user, clientId);
        return this.settings.list(organizationId, clientId ?? null);
    }
    async update(request, dto, clientId) {
        const valores = dto.values ?? {};
        const touchesModuleLifecycle = Object.keys(valores).some((key) => key.startsWith('modules.lifecycle.'));
        if (touchesModuleLifecycle && request.user.role !== user_role_enum_1.UserRole.DEV) {
            throw new common_1.ForbiddenException('Solo desarrollo puede cambiar el ciclo de vida de módulos.');
        }
        const sinSalida = organization_features_1.REQUIRED_LIFECYCLE_KEYS
            .filter((module) => {
            const valor = valores[(0, shared_1.moduleLifecycleSettingKey)(module)];
            return typeof valor === 'string' && !(0, shared_1.isModuleLifecycleVisible)(valor);
        });
        if (sinSalida.length) {
            throw new common_1.BadRequestException(`No se puede esconder ${sinSalida.join(' ni ')}: son la puerta de entrada y el sitio donde se deshace este cambio. ` +
                'Déjalos en activo, piloto o mantenimiento.');
        }
        const organizationId = request.organizationId || request.user.organizationId;
        await this.accountAccess.assertClient(organizationId, request.user, clientId);
        return this.settings.update(organizationId, request.user.id, dto.values, clientId ?? null);
    }
    async correos(request, clientId) {
        clientId = this.empresaDeLaSesion(request, clientId);
        const organizationId = request.organizationId || request.user.organizationId;
        await this.accountAccess.assertClient(organizationId, request.user, clientId);
        const puede = await this.modulosQuePuedeEditar(request, clientId);
        if (puede.size === 0)
            throw new common_1.ForbiddenException('No hay plantillas que puedas editar en esta empresa');
        const ajustes = await this.settings.list(organizationId, clientId ?? null);
        return ajustes.filter((ajuste) => ES_CLAVE_DE_CORREO(ajuste.key) && puede.has(moduloDeCorreo(ajuste.key)));
    }
    async modulosQuePuedeEditar(request, clientId) {
        const organizationId = request.organizationId || request.user.organizationId;
        const contratados = clientId
            ? { reservations: await this.capacidades.tiene(organizationId, clientId, 'reservations'), surveys: await this.capacidades.tiene(organizationId, clientId, 'surveys'), crm: await this.capacidades.tiene(organizationId, clientId, 'crm') }
            : null;
        const puede = new Set();
        for (const modulo of ['reservations', 'surveys', 'crm']) {
            if (contratados && contratados[modulo] !== true)
                continue;
            if (await this.permisos.can(organizationId, request.user.id, request.user.role, modulo, 'edit'))
                puede.add(modulo);
        }
        return puede;
    }
    async guardarCorreos(request, dto, clientId) {
        clientId = this.empresaDeLaSesion(request, clientId);
        const valores = dto.values ?? {};
        const ajenas = Object.keys(valores).filter((clave) => !ES_CLAVE_DE_CORREO(clave));
        if (ajenas.length)
            throw new common_1.ForbiddenException(`Desde Correos sólo se guardan plantillas de correo: ${ajenas.join(', ')}`);
        const puede = await this.modulosQuePuedeEditar(request, clientId);
        const sinPermiso = Object.keys(valores).filter((clave) => !puede.has(moduloDeCorreo(clave)));
        if (sinPermiso.length)
            throw new common_1.ForbiddenException(`No puedes editar estas plantillas: ${sinPermiso.join(', ')}`);
        const organizationId = request.organizationId || request.user.organizationId;
        await this.accountAccess.assertClient(organizationId, request.user, clientId);
        return this.settings.update(organizationId, request.user.id, valores, clientId ?? null);
    }
    estadoDelCorreo(request) {
        const estado = this.correo.estado();
        return request.user.role === user_role_enum_1.UserRole.DEV ? estado : { ...estado, faltan: [] };
    }
    async requisitosDeCorreo() {
        const corridas = new Map((await this.corridas.find()).map((fila) => [fila.task, fila]));
        const limite = Date.now() - requisitos_de_correo_1.HORAS_SIN_CORRER_PARA_ALARMA * 3_600_000;
        const casilla = this.correo.estado().habilitado;
        const tareas = Object.fromEntries([...new Set(Object.values(requisitos_de_correo_1.REQUISITOS_POR_AVISO).flatMap((lista) => lista.map((requisito) => requisito.tarea).filter(Boolean)))].map((tarea) => {
            const corrida = corridas.get(tarea);
            return [tarea, {
                    ultima: corrida?.lastRunAt ?? null,
                    corriendo: Boolean(corrida && corrida.ok && corrida.lastRunAt.getTime() > limite),
                }];
        }));
        return { casilla, tareas, avisos: requisitos_de_correo_1.REQUISITOS_POR_AVISO };
    }
    async destinatariosDePrueba(request) {
        const organizationId = request.organizationId || request.user.organizationId;
        const equipo = await this.usuarios.find({
            where: { organizationId, isActive: true },
            select: { id: true, name: true, email: true },
            order: { name: 'ASC' },
        });
        return equipo.filter((persona) => persona.email?.trim());
    }
    vistaPreviaDeCorreo(dto) {
        return (0, plantilla_de_correo_1.componerCorreo)(String(dto?.asunto ?? ''), String(dto?.cuerpo ?? ''), muestra_de_correo_1.MUESTRA);
    }
    async probar(request, dto) {
        const destino = await this.direccionDelDestinatario(request, dto?.destinatarioId);
        const { subject, html } = (0, plantilla_de_correo_1.componerCorreo)(String(dto?.asunto ?? 'Prueba'), String(dto?.cuerpo ?? ''), muestra_de_correo_1.MUESTRA);
        const enviado = await this.correo.send(destino, `[Prueba] ${subject}`, html);
        return {
            enviado,
            destino,
            motivo: enviado ? null : 'El envío de correo está apagado en el servidor (SMTP_ENABLED)',
        };
    }
    async direccionDelDestinatario(request, destinatarioId) {
        if (!destinatarioId) {
            const propio = request.user.email;
            if (!propio)
                throw new common_1.BadRequestException('Tu usuario no tiene correo, así que no hay dónde enviarlo');
            return propio;
        }
        const organizationId = request.organizationId || request.user.organizationId;
        const persona = await this.usuarios.findOne({
            where: { id: destinatarioId, organizationId, isActive: true },
            select: { id: true, email: true },
        });
        if (!persona)
            throw new common_1.BadRequestException('Esa persona no está en tu equipo');
        if (!persona.email?.trim())
            throw new common_1.BadRequestException('Esa persona no tiene correo registrado');
        return persona.email;
    }
    empresaDeLaSesion(request, pedido) {
        if (request.user.role === user_role_enum_1.UserRole.CLIENT)
            return request.user.clientId ?? undefined;
        return pedido;
    }
};
exports.OrganizationSettingsController = OrganizationSettingsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener configuración efectiva, opcionalmente de una empresa' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrganizationSettingsController.prototype, "list", null);
__decorate([
    (0, common_1.Put)(),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar y auditar configuración de la organización' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_organization_settings_dto_1.UpdateOrganizationSettingsDto, String]),
    __metadata("design:returntype", Promise)
], OrganizationSettingsController.prototype, "update", null);
__decorate([
    (0, module_scope_decorator_1.ModuleExempt)('Cada plantilla exige el permiso de su propio módulo, comprobado en el método'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.DEV, user_role_enum_1.UserRole.CLIENT),
    (0, common_1.Get)('correos'),
    (0, swagger_1.ApiOperation)({ summary: 'Plantillas de correo efectivas, opcionalmente de una empresa' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrganizationSettingsController.prototype, "correos", null);
__decorate([
    (0, module_scope_decorator_1.ModuleExempt)('Cada plantilla exige el permiso de su propio módulo, comprobado en el método'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.DEV, user_role_enum_1.UserRole.CLIENT),
    (0, common_1.Put)('correos'),
    (0, swagger_1.ApiOperation)({ summary: 'Guardar plantillas de correo' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_organization_settings_dto_1.UpdateOrganizationSettingsDto, String]),
    __metadata("design:returntype", Promise)
], OrganizationSettingsController.prototype, "guardarCorreos", null);
__decorate([
    (0, common_1.Get)('estado-del-correo'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'edit'),
    (0, swagger_1.ApiOperation)({ summary: 'Estado del envío de correos' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrganizationSettingsController.prototype, "estadoDelCorreo", null);
__decorate([
    (0, common_1.Get)('correos/requisitos'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'edit'),
    (0, swagger_1.ApiOperation)({ summary: 'Condiciones que necesita cada aviso además de su interruptor' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrganizationSettingsController.prototype, "requisitosDeCorreo", null);
__decorate([
    (0, common_1.Get)('destinatarios-de-prueba'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'edit'),
    (0, swagger_1.ApiOperation)({ summary: 'Personas del equipo a las que se puede enviar una prueba' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrganizationSettingsController.prototype, "destinatariosDePrueba", null);
__decorate([
    (0, common_1.Post)('correos/vista-previa'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'edit'),
    (0, swagger_1.ApiOperation)({ summary: 'Componer una plantilla para verla, sin enviarla' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrganizationSettingsController.prototype, "vistaPreviaDeCorreo", null);
__decorate([
    (0, common_1.Post)('probar'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'edit'),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Enviar una plantilla de correo a alguien del equipo' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OrganizationSettingsController.prototype, "probar", null);
exports.OrganizationSettingsController = OrganizationSettingsController = __decorate([
    (0, swagger_1.ApiTags)('Configuración'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('settings'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.DEV),
    (0, module_scope_decorator_1.ModuleScope)('settings'),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => permission_resolver_service_1.PermissionResolverService))),
    __param(5, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(6, (0, typeorm_1.InjectRepository)(cron_run_entity_1.CronRun)),
    __metadata("design:paramtypes", [organization_settings_service_1.OrganizationSettingsService,
        permission_resolver_service_1.PermissionResolverService,
        account_access_service_1.AccountAccessService,
        client_capability_service_1.ClientCapabilityService,
        email_service_1.EmailService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], OrganizationSettingsController);
