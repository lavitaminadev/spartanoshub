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
var ReservationsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationsController = void 0;
const permission_resolver_service_1 = require("../../core/authorization/permission-resolver.service");
const common_1 = require("@nestjs/common");
const datos_legales_de_empresa_1 = require("../clients/datos-legales-de-empresa");
const typeorm_1 = require("typeorm");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const node_events_1 = require("node:events");
const account_access_service_1 = require("../../core/client-scope/account-access.service");
const client_capability_service_1 = require("../../core/client-scope/client-capability.service");
const audit_service_1 = require("../../core/audit/audit.service");
const nivel_de_datos_service_1 = require("../../core/client-scope/nivel-de-datos.service");
const shared_1 = require("@espartanos/shared");
const empresa_decorator_1 = require("../../core/client-scope/empresa.decorator");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const requires_permission_decorator_1 = require("../../core/authorization/requires-permission.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const reservations_service_1 = require("./application/reservations.service");
const bulk_import_service_1 = require("./application/bulk-import.service");
const exportaciones_1 = require("./application/exportaciones");
const reservation_dto_1 = require("./dto/reservation.dto");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
const requiere_accion_1 = require("../../core/authorization/requiere-accion");
const requiere_area_decorator_1 = require("../../core/authorization/requiere-area.decorator");
let ReservationsController = ReservationsController_1 = class ReservationsController {
    constructor(service, accountAccess, capabilities, bulkImport, audit, dataSource, permisos, niveles) {
        this.service = service;
        this.accountAccess = accountAccess;
        this.capabilities = capabilities;
        this.bulkImport = bulkImport;
        this.audit = audit;
        this.dataSource = dataSource;
        this.permisos = permisos;
        this.niveles = niveles;
    }
    publicOrigin() {
        return (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '') || undefined;
    }
    async decorateForm(organizationId, clientId, form) {
        const context = await this.service.formContext(organizationId, clientId, form);
        const publicOrigin = this.publicOrigin();
        return { ...form, ...context, publicUrl: publicOrigin ? `${publicOrigin}/book/${form.publicSlug}` : undefined };
    }
    async empresaDelPortalEnLaPeticion(req) {
        if (req.user.role !== user_role_enum_1.UserRole.CLIENT)
            return undefined;
        const declarada = req.query?.clientId?.trim();
        if (declarada && declarada !== req.user.clientId) {
            await this.accountAccess.assertClient(req.organizationId, req.user, declarada);
            return declarada;
        }
        if (!req.user.clientId)
            throw new common_1.ForbiddenException('La cuenta cliente no está asociada a una empresa');
        return req.user.clientId;
    }
    async scope(req) {
        const clientId = await this.empresaDelPortalEnLaPeticion(req);
        if (clientId)
            await this.capabilities.assert(req.organizationId, clientId, 'reservations');
        return {
            clientId,
            clientIds: await this.accountAccess.allowedClientIds(req.organizationId, req.user),
        };
    }
    async recortada(req, reserva) {
        const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'reservations');
        return (0, nivel_de_datos_service_1.recortarFilasPorEmpresa)([reserva], 'reservations', niveles)[0];
    }
    async requestedScope(req, requestedClientId) {
        const scope = await this.scope(req);
        if (!requestedClientId)
            return scope;
        await this.accountAccess.assertClient(req.organizationId, req.user, requestedClientId);
        return { clientId: requestedClientId, clientIds: undefined };
    }
    async companyLegal(req, query) {
        return (0, datos_legales_de_empresa_1.leerDatosLegales)(this.dataSource, req.organizationId, await this.empresaLegal(req, query.clientId));
    }
    async saveCompanyLegal(req, query, dto) {
        const empresa = await this.empresaLegal(req, query.clientId);
        await (0, datos_legales_de_empresa_1.asegurarQueAdministraLaEmpresa)(this.permisos, req.organizationId, req.user, empresa);
        const laAceptaLaEmpresa = req.user.role === user_role_enum_1.UserRole.CLIENT;
        return (0, datos_legales_de_empresa_1.guardarDatosLegales)(this.dataSource, this.audit, req.organizationId, empresa, { ...dto, aceptaEncargo: laAceptaLaEmpresa ? dto.aceptaEncargo : undefined }, req.user.id, req.user.name);
    }
    async empresaLegal(req, pedida) {
        const empresa = await (0, datos_legales_de_empresa_1.empresaDeLosDatosLegales)(this.accountAccess, req.organizationId, req.user, pedida);
        await this.capabilities.assert(req.organizationId, empresa, 'reservations');
        return empresa;
    }
    async metaHealth(req, id) {
        const scope = await this.scope(req);
        return this.service.saludDeMedicion(req.organizationId, id, scope.clientId, scope.clientIds);
    }
    async pixelesDisponibles(req, query) {
        const scope = await this.requestedScope(req, query.clientId);
        const clientId = scope.clientId ?? query.clientId;
        if (!clientId)
            throw new common_1.ForbiddenException('Indica la empresa del local');
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        return this.service.pixelesDelFormulario(req.organizationId, clientId);
    }
    catalogoDeRubros() {
        return { data: shared_1.CATALOGO_DE_RUBROS };
    }
    async forms(req, query) {
        const scope = await this.requestedScope(req, query.clientId);
        const forms = await this.service.listForms(req.organizationId, scope.clientId, scope.clientIds);
        const publicOrigin = this.publicOrigin();
        return forms.map((form) => ({ ...form, publicUrl: publicOrigin ? `${publicOrigin}/book/${form.publicSlug}` : undefined }));
    }
    async create(req, dto) {
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
        const form = await this.service.createForm(req.organizationId, req.user.id, dto);
        return this.decorateForm(req.organizationId, form.clientId, form);
    }
    async form(req, id) {
        const scope = await this.scope(req);
        const form = await this.service.getForm(req.organizationId, id, scope.clientId, scope.clientIds);
        return this.decorateForm(req.organizationId, form.clientId, form);
    }
    async pause(req, id, dto) {
        const scope = await this.scope(req);
        const form = await this.service.pauseForm(req.organizationId, id, dto.until ?? '', scope.clientId, scope.clientIds, req.user.id);
        return this.decorateForm(req.organizationId, form.clientId, form);
    }
    async update(req, id, dto) {
        const scope = await this.scope(req);
        if (!ReservationsController_1.DECLARAN_LA_EXCEPCION.includes(req.user.role)) {
            delete dto.consentimientoNoAplica;
            delete dto.motivoSinConsentimiento;
        }
        if (req.user.role === user_role_enum_1.UserRole.CLIENT) {
            const allowed = {
                timezone: dto.timezone,
                durationMinutes: dto.durationMinutes,
                bufferMinutes: dto.bufferMinutes,
                capacityPerSlot: dto.capacityPerSlot,
                dailyCapacity: dto.dailyCapacity,
                minimumNoticeHours: dto.minimumNoticeHours,
                maximumAdvanceDays: dto.maximumAdvanceDays,
                confirmationMode: dto.confirmationMode,
                fieldSchema: dto.fieldSchema,
                scheduleConfig: dto.scheduleConfig,
                servicesConfig: dto.servicesConfig,
                resourcesConfig: dto.resourcesConfig,
                designConfig: dto.designConfig,
                name: dto.name,
                status: dto.status,
                teamNotifications: dto.teamNotifications,
                calendarEnabled: dto.calendarEnabled,
            };
            const form = await this.service.updateForm(req.organizationId, id, allowed, scope.clientId, scope.clientIds);
            return this.decorateForm(req.organizationId, form.clientId, form);
        }
        const form = await this.service.updateForm(req.organizationId, id, dto, scope.clientId, scope.clientIds);
        return this.decorateForm(req.organizationId, form.clientId, form);
    }
    async actualizarOperacion(req, id, dto) {
        const scope = await this.scope(req);
        const form = await this.service.actualizarOperacion(req.organizationId, id, dto, scope.clientId, scope.clientIds);
        return this.decorateForm(req.organizationId, form.clientId, form);
    }
    async duplicate(req, id) {
        const scope = await this.scope(req);
        const form = await this.service.duplicateForm(req.organizationId, id, req.user.id, scope.clientIds);
        return this.decorateForm(req.organizationId, form.clientId, form);
    }
    async ultimosCambios(req, id) {
        const scope = await this.scope(req);
        return this.service.ultimosCambios(req.organizationId, id, scope.clientId, scope.clientIds);
    }
    async blocks(req, id) {
        const scope = await this.scope(req);
        return this.service.listBlocks(req.organizationId, id, scope.clientId, scope.clientIds);
    }
    async block(req, id, dto) {
        const scope = await this.scope(req);
        return this.service.addBlock(req.organizationId, id, req.user.id, dto, scope.clientId, scope.clientIds);
    }
    async batchBlock(req, id, dtos) {
        if (dtos.length > 365)
            throw new common_1.BadRequestException('No puedes crear mas de 365 bloqueos por lote');
        const scope = await this.scope(req);
        const errors = [];
        const results = await Promise.all(dtos.map((dto) => this.service.addBlock(req.organizationId, id, req.user.id, dto, scope.clientId, scope.clientIds).catch((err) => { errors.push(err.message); return null; })));
        if (errors.length && results.filter(Boolean).length === 0)
            throw new common_1.BadRequestException(errors.join('; '));
        return { created: results.filter(Boolean).length, total: dtos.length, errors: errors.length ? errors : undefined };
    }
    async deleteBlock(req, id) {
        const scope = await this.scope(req);
        return this.service.removeBlock(req.organizationId, id, scope.clientId, scope.clientIds, req.user.id);
    }
    async createManual(req, dto) {
        const scope = await this.scope(req);
        if (req.user.role === user_role_enum_1.UserRole.CLIENT)
            dto.skipAvailability = false;
        return this.recortada(req, await this.service.createManual(req.organizationId, req.user.id, dto, scope.clientId, scope.clientIds));
    }
    async importReservations(req, dto) {
        const scope = await this.scope(req);
        if (dto.dryRun) {
            const form = await this.service.getForm(req.organizationId, dto.formId, scope.clientId, scope.clientIds);
            return this.bulkImport.parse(dto.csvContent, dto.formId, form.timezone);
        }
        return this.bulkImport.import(req.organizationId, req.user.id, dto.csvContent, dto.formId, {
            skipAvailability: dto.skipAvailability,
            clientId: scope.clientId,
            clientIds: scope.clientIds,
        });
    }
    async list(req, query) {
        const scope = await this.requestedScope(req, query.clientId);
        const respuesta = await this.service.listReservations(req.organizationId, query, scope.clientId, scope.clientIds, req.user.role !== user_role_enum_1.UserRole.CLIENT);
        const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'reservations');
        return { ...respuesta, data: (0, nivel_de_datos_service_1.recortarFilasPorEmpresa)(respuesta.data, 'reservations', niveles) };
    }
    async updateReservation(req, id, dto) {
        const scope = await this.scope(req);
        if (req.user.role === user_role_enum_1.UserRole.CLIENT && dto.workflowState !== undefined) {
            throw new common_1.ForbiddenException('La etapa de producción la gestiona el equipo de Espartanos');
        }
        return this.recortada(req, await this.service.updateReservation(req.organizationId, id, dto, req.user.id, req.user.role === user_role_enum_1.UserRole.CLIENT ? 'client' : 'team', scope.clientId, scope.clientIds));
    }
    async allGroupRequests(req, formId, clientId) {
        const scope = await this.requestedScope(req, clientId);
        return this.service.listAllGroupRequests(req.organizationId, scope.clientId, scope.clientIds, formId);
    }
    async groupRequests(req, id) {
        const scope = await this.scope(req);
        return this.service.listGroupRequests(req.organizationId, id, scope.clientId, scope.clientIds);
    }
    async convertGroupRequest(req, id, dto) {
        const scope = await this.scope(req);
        return this.service.convertGroupRequest(req.organizationId, id, dto, req.user.id, scope.clientId, scope.clientIds);
    }
    async updateGroupRequest(req, id, dto) {
        const scope = await this.scope(req);
        return this.service.updateGroupRequest(req.organizationId, id, dto, req.user.id, scope.clientId, scope.clientIds);
    }
    async closeDay(req, dto) {
        const scope = await this.scope(req);
        return this.service.closeDayByException(req.organizationId, dto, req.user.id, scope.clientId, scope.clientIds);
    }
    async guestHistory(req, id) {
        const scope = await this.scope(req);
        const historial = await this.service.guestHistory(req.organizationId, id, scope.clientId, scope.clientIds);
        const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'reservations');
        if (niveles.de(historial.clientId) === 'directo')
            return historial;
        const { preferencias: _preferencias, ...sinPreferencias } = historial;
        return sinPreferencias;
    }
    async datosProtegidos(req, id) {
        const scope = await this.scope(req);
        const reserva = await this.service.datosProtegidosDeReserva(req.organizationId, id, scope.clientId, scope.clientIds);
        const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'reservations');
        const nivel = niveles.de(reserva.clientId);
        if (nivel === 'oculto')
            throw new common_1.ForbiddenException('Tu perfil no permite ver estos datos');
        if (nivel === 'bajo_registro') {
            await this.audit.log({
                organizationId: req.organizationId, actorId: req.user.id, entityType: 'reservations', entityId: id,
                action: 'reveal_protected_data', reason: `campos=${Object.keys(reserva.datos).join(',')}`,
                ipAddress: req.ip,
            });
        }
        return { id, datos: reserva.datos };
    }
    async registrarSalida(req, id, dto) {
        const scope = await this.scope(req);
        return this.service.registrarSalida(req.organizationId, id, dto.accion, req.user.id, req.user.role === user_role_enum_1.UserRole.CLIENT ? 'client' : 'team', scope.clientId, scope.clientIds);
    }
    async history(req, id) {
        const scope = await this.scope(req);
        return this.service.history(req.organizationId, id, scope.clientId, scope.clientIds);
    }
    async historialDelComensal(req, id) {
        const scope = await this.scope(req);
        const historial = await this.service.historialDelComensal(req.organizationId, id, scope.clientId, scope.clientIds);
        const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'reservations');
        const [comensal] = (0, nivel_de_datos_service_1.recortarFilasPorEmpresa)([historial.comensal], 'reservations', niveles);
        return { ...historial, comensal };
    }
    async historialDeReserva(req, id) {
        const scope = await this.scope(req);
        return this.service.historialDeReserva(req.organizationId, id, scope.clientIds);
    }
    async listCoupons(req, query) {
        const scope = await this.requestedScope(req, query.clientId);
        const [cupones, uso] = await Promise.all([
            this.service.listCoupons(req.organizationId, scope.clientId, scope.clientIds, { estado: query.estado, codigo: query.codigo }),
            this.service.usoDeCupones(req.organizationId, scope.clientId, scope.clientIds, { desde: query.desde, hasta: query.hasta }),
        ]);
        const porCodigo = new Map(uso.map((fila) => [fila.code, fila]));
        return cupones.map((cupon) => ({
            ...cupon,
            uso: porCodigo.get(cupon.code) ?? { code: cupon.code, enviados: 0, usados: 0, volvieronDelCorreo: 0 },
        }));
    }
    async createCoupon(req, dto) {
        if (req.user.role === user_role_enum_1.UserRole.CLIENT)
            dto.clientId = (await this.empresaDelPortalEnLaPeticion(req));
        if (!dto.clientId)
            throw new common_1.BadRequestException('Elige la empresa del cupón: cada cupón vale sólo en los locales de su empresa.');
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
        await this.capabilities.assert(req.organizationId, dto.clientId, 'reservations');
        return this.service.createCoupon(req.organizationId, req.user.id, dto, dto.clientId);
    }
    async updateCoupon(req, id, dto) {
        const scope = await this.scope(req);
        return this.service.updateCoupon(req.organizationId, id, dto, scope.clientIds);
    }
    async buscarCupon(req, codigo) {
        if (!codigo?.trim())
            throw new common_1.BadRequestException('Escribe el código del cupón');
        const scope = await this.scope(req);
        return this.service.buscarCuponPorCodigo(req.organizationId, codigo, scope.clientIds);
    }
    async metricasDeCupon(req, id) {
        const scope = await this.scope(req);
        return this.service.metricasDeCupon(req.organizationId, id, scope.clientIds);
    }
    async canjesDeCupon(req, id, query) {
        const scope = await this.scope(req);
        return this.service.canjesDeCupon(req.organizationId, id, scope.clientIds, query);
    }
    async canjesCsv(req, id, query, res) {
        const scope = await this.scope(req);
        const csv = await this.service.csvDeCanjes(req.organizationId, id, scope.clientIds, query);
        void this.audit.log({
            organizationId: req.organizationId, actorId: req.user.id, entityType: 'reservation_coupons',
            action: 'export_canjes_csv', reason: `coupon=${id} desde=${query.desde ?? ''} hasta=${query.hasta ?? ''}`,
            ipAddress: req.ip,
        }).catch(() => { });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="canjes-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send(csv);
    }
    async canjearCuponEnLocal(req, id, dto) {
        const scope = await this.scope(req);
        return this.service.canjearCuponEnLocal(req.organizationId, id, req.user.id, dto, scope.clientIds);
    }
    async exportCsv(req, query, res) {
        const scope = await this.requestedScope(req, query.clientId);
        const niveles = await this.niveles.nivelesDe(req.organizationId, req.user.id, 'reservations');
        const { columnas, conProtegidos } = (0, exportaciones_1.columnasDelCsv)(niveles, scope.clientId, scope.clientIds);
        const filas = await this.service.contarParaExportar(req.organizationId, scope.clientId, scope.clientIds, query.from, query.to, query.limit);
        await this.service.registrarExportacion({
            organizationId: req.organizationId, actor: { id: req.user.id, nombre: req.user.name }, ip: req.ip,
            finalidad: 'procesable', formato: 'csv',
            filtro: { clientId: scope.clientId ?? null, desde: query.from ?? null, hasta: query.to ?? null, limite: query.limit ?? null },
            filas, columnas, conProtegidos, desde: query.from, hasta: query.to, motivo: query.motivo,
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="reservas-para-procesar-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.setHeader('X-Uso', 'interno; contiene datos personales');
        res.write('\uFEFF');
        for await (const chunk of this.service.streamCsv(req.organizationId, niveles, scope.clientId, scope.clientIds, query.from, query.to, query.limit)) {
            if (!res.write(chunk))
                await (0, node_events_1.once)(res, 'drain');
        }
        res.end();
    }
    async exportForm(req, formId, body, res) {
        const scope = await this.scope(req);
        const { cuerpo } = await this.service.exportFormReservations({
            organizationId: req.organizationId,
            niveles: await this.niveles.nivelesDe(req.organizationId, req.user.id, 'reservations'),
            formId,
            clientId: scope.clientId,
            clientIds: scope.clientIds,
            formato: body.format,
            dateFrom: body.dateFrom,
            dateTo: body.dateTo,
            fields: body.fields,
            includeInternalNotes: req.user.role !== user_role_enum_1.UserRole.CLIENT,
            actor: { id: req.user.id, nombre: req.user.name },
            motivo: body.motivo,
            ip: req.ip,
        });
        const dia = new Date().toISOString().slice(0, 10);
        res.setHeader('X-Uso', 'interno; contiene datos personales');
        if (body.format === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="reservas-para-procesar-${dia}.csv"`);
            res.send(cuerpo);
        }
        else {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="reservas-${dia}.xlsx"`);
            res.end(cuerpo);
        }
    }
    async hojaDelTurno(req, formId, query, res) {
        const scope = await this.scope(req);
        const hoja = await this.service.hojaDelTurno({
            organizationId: req.organizationId, formId, fecha: query.fecha,
            clientId: scope.clientId, clientIds: scope.clientIds,
            actor: { id: req.user.id, nombre: req.user.name }, ip: req.ip,
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${hoja.nombre}"`);
        res.end(hoja.cuerpo);
    }
    async operationalHome(req, query) {
        const scope = await this.requestedScope(req, query.clientId);
        return this.service.operationalHome(req.organizationId, scope.clientId, scope.clientIds);
    }
    async metrics(req, query) {
        const scope = await this.requestedScope(req, query.clientId);
        return this.service.metrics(req.organizationId, scope.clientId, scope.clientIds, query.days ? String(query.days) : '30');
    }
    async noShow(req, query) {
        const scope = await this.requestedScope(req, query.clientId);
        return this.service.noShowPorLocalYDia(req.organizationId, scope.clientId, scope.clientIds, query.days ? Number(query.days) : 90);
    }
    async asistenciaPorOrigen(req, query) {
        const scope = await this.requestedScope(req, query.clientId);
        return this.service.asistenciaPorOrigen(req.organizationId, scope.clientId, scope.clientIds, query.days ? Number(query.days) : 90);
    }
    async occupancy(req, query) {
        const scope = await this.requestedScope(req, query.clientId);
        if (query.formId)
            await this.service.getForm(req.organizationId, query.formId, scope.clientId, scope.clientIds);
        return this.service.occupancyCalendar(req.organizationId, query.month, scope.clientId, scope.clientIds, query.formId);
    }
    async surveyContacts(req, clientId) {
        const scope = await this.requestedScope(req, clientId);
        return this.service.listSurveyContactRequests(req.organizationId, scope.clientId, scope.clientIds);
    }
    async updateSurveyContact(req, id, body) {
        const scope = await this.scope(req);
        return this.service.updateSurveyContactRequest(req.organizationId, id, body, scope.clientId, scope.clientIds, req.user.id);
    }
    async getReservation(req, id) {
        const scope = await this.scope(req);
        const reserva = await this.service.getReservation(req.organizationId, id, scope.clientId, scope.clientIds);
        return this.recortada(req, reserva);
    }
};
exports.ReservationsController = ReservationsController;
ReservationsController.DECLARAN_LA_EXCEPCION = [user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.DEV, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR];
__decorate([
    (0, common_1.Get)('company-legal'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, datos_legales_de_empresa_1.CompanyLegalScopeDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "companyLegal", null);
__decorate([
    (0, common_1.Put)('company-legal'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, datos_legales_de_empresa_1.CompanyLegalScopeDto, datos_legales_de_empresa_1.CompanyLegalDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "saveCompanyLegal", null);
__decorate([
    (0, common_1.Get)('forms/:id/meta-health'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.medicion', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "metaHealth", null);
__decorate([
    (0, common_1.Get)('forms/meta-pixels'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.medicion', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ReservationScopeDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "pixelesDisponibles", null);
__decorate([
    (0, common_1.Get)('catalogo-de-rubros'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    (0, empresa_decorator_1.SinEmpresa)('el catálogo es el mismo para toda la organización y no describe a ninguna empresa'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ReservationsController.prototype, "catalogoDeRubros", null);
__decorate([
    (0, common_1.Get)('forms'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ReservationScopeDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "forms", null);
__decorate([
    (0, common_1.Post)('forms'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.configurar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.CreateReservationFormDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('forms/:id'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.configurar', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "form", null);
__decorate([
    (0, common_1.Patch)('forms/:id/pause'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.publicar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.PauseReservationFormDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "pause", null);
__decorate([
    (0, common_1.Patch)('forms/:id'),
    (0, requiere_accion_1.RequiereAccion)('reservations.configurar'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.configurar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.UpdateReservationFormDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)('forms/:id/operacion'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'edit'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.configurar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.ActualizarOperacionDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "actualizarOperacion", null);
__decorate([
    (0, common_1.Post)('forms/:id/duplicate'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.configurar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "duplicate", null);
__decorate([
    (0, common_1.Get)('forms/:id/ultimos-cambios'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.configurar', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "ultimosCambios", null);
__decorate([
    (0, common_1.Get)('forms/:id/blocks'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.configurar', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "blocks", null);
__decorate([
    (0, common_1.Post)('forms/:id/blocks'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.configurar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.CreateBlockDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "block", null);
__decorate([
    (0, common_1.Post)('forms/:id/blocks/batch'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.configurar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)(new common_1.ParseArrayPipe({ items: reservation_dto_1.CreateBlockDto, whitelist: true, forbidNonWhitelisted: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Array]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "batchBlock", null);
__decorate([
    (0, common_1.Delete)('blocks/:id'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'edit'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.configurar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "deleteBlock", null);
__decorate([
    (0, common_1.Post)('manual'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.tomar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.CreateManualReservationDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "createManual", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, requiere_accion_1.RequiereAccion)('reservations.importar'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.configurar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ImportReservationsDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "importReservations", null);
__decorate([
    (0, common_1.Get)(),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.reservas', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ListReservationsDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.reservas', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.UpdateReservationDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "updateReservation", null);
__decorate([
    (0, common_1.Get)('group-requests'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.espera_y_grupos', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('formId')),
    __param(2, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "allGroupRequests", null);
__decorate([
    (0, common_1.Get)('forms/:id/group-requests'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.espera_y_grupos', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "groupRequests", null);
__decorate([
    (0, common_1.Post)('group-requests/:id/convert'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.espera_y_grupos', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.ConvertGroupRequestDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "convertGroupRequest", null);
__decorate([
    (0, common_1.Patch)('group-requests/:id'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.espera_y_grupos', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.UpdateGroupRequestDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "updateGroupRequest", null);
__decorate([
    (0, common_1.Post)('close-day'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.configurar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.CloseReservationDayDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "closeDay", null);
__decorate([
    (0, common_1.Get)(':id/guest-history'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.reservas', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "guestHistory", null);
__decorate([
    (0, common_1.Get)(':id/datos-protegidos'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.reservas', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "datosProtegidos", null);
__decorate([
    (0, common_1.Post)(':id/salida'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.turno', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.RegistrarSalidaDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "registrarSalida", null);
__decorate([
    (0, common_1.Get)(':id/history'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.reservas', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "history", null);
__decorate([
    (0, common_1.Get)(':id/historial-del-comensal'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.historial', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "historialDelComensal", null);
__decorate([
    (0, common_1.Get)(':id/historial'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'view'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.reservas', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "historialDeReserva", null);
__decorate([
    (0, common_1.Get)('coupons'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.cupones', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ListCouponsDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "listCoupons", null);
__decorate([
    (0, common_1.Post)('coupons'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'manage'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.cupones', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.CreateCouponDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "createCoupon", null);
__decorate([
    (0, common_1.Patch)('coupons/:id'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'manage'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.cupones', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.UpdateCouponDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "updateCoupon", null);
__decorate([
    (0, common_1.Get)('coupons/buscar'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'edit'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.canjear_cupon', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('codigo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "buscarCupon", null);
__decorate([
    (0, common_1.Get)('coupons/:id/metricas'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'view'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.cupones', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "metricasDeCupon", null);
__decorate([
    (0, common_1.Get)('coupons/:id/canjes'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'view'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.cupones', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.ListCanjesDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "canjesDeCupon", null);
__decorate([
    (0, common_1.Get)('coupons/:id/canjes.csv'),
    (0, requiere_accion_1.RequiereAccion)('reservations.exportar'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.exportar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.ListCanjesDto, Object]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "canjesCsv", null);
__decorate([
    (0, common_1.Post)('coupons/:id/canjes'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'edit'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.canjear_cupon', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.CanjeDeCuponDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "canjearCuponEnLocal", null);
__decorate([
    (0, common_1.Get)('export/csv'),
    (0, requiere_accion_1.RequiereAccion)('reservations.exportar'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.exportar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ExportCsvQueryDto, Object]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "exportCsv", null);
__decorate([
    (0, common_1.Post)('forms/:formId/export'),
    (0, requiere_accion_1.RequiereAccion)('reservations.exportar'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.exportar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('formId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.ExportFormReservationsDto, Object]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "exportForm", null);
__decorate([
    (0, common_1.Get)('forms/:formId/hoja-del-turno'),
    (0, requiere_accion_1.RequiereAccion)('reservations.exportar'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.exportar', 'hacer'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('formId')),
    __param(2, (0, common_1.Query)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.HojaDelTurnoDto, Object]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "hojaDelTurno", null);
__decorate([
    (0, common_1.Get)('analytics/operational-home'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.medicion', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ReservationScopeDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "operationalHome", null);
__decorate([
    (0, common_1.Get)('analytics/metrics'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.medicion', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ReservationScopeDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "metrics", null);
__decorate([
    (0, common_1.Get)('analytics/no-show'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.historial', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ReservationScopeDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "noShow", null);
__decorate([
    (0, common_1.Get)('analytics/por-origen'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.medicion', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ReservationScopeDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "asistenciaPorOrigen", null);
__decorate([
    (0, common_1.Get)('analytics/occupancy'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.medicion', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.OccupancyQueryDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "occupancy", null);
__decorate([
    (0, common_1.Get)('survey-contact-requests'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "surveyContacts", null);
__decorate([
    (0, common_1.Put)('survey-contact-requests/:id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.UpdateContactRequestDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "updateSurveyContact", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, requiere_area_decorator_1.RequiereArea)('reservations.reservas', 'ver'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "getReservation", null);
exports.ReservationsController = ReservationsController = ReservationsController_1 = __decorate([
    (0, swagger_1.ApiTags)('Reservas'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Controller)('reservations'),
    (0, module_scope_decorator_1.ModuleScope)('reservations'),
    __metadata("design:paramtypes", [reservations_service_1.ReservationsService,
        account_access_service_1.AccountAccessService,
        client_capability_service_1.ClientCapabilityService,
        bulk_import_service_1.ReservationsBulkImportService,
        audit_service_1.AuditService,
        typeorm_1.DataSource,
        permission_resolver_service_1.PermissionResolverService,
        nivel_de_datos_service_1.NivelDeDatosService])
], ReservationsController);
