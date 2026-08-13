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
var ReservationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const dns_1 = require("dns");
const reservation_form_entity_1 = require("../domain/reservation-form.entity");
const reservation_entity_1 = require("../domain/reservation.entity");
const availability_block_entity_1 = require("../domain/availability-block.entity");
const reservation_event_entity_1 = require("../domain/reservation-event.entity");
const reservation_form_event_entity_1 = require("../domain/reservation-form-event.entity");
const reservation_coupon_entity_1 = require("../domain/reservation-coupon.entity");
const survey_contact_request_entity_1 = require("../domain/survey-contact-request.entity");
const reservation_catalog_entity_1 = require("../domain/reservation-catalog.entity");
const timezone_1 = require("../domain/timezone");
const phone_1 = require("../../../shared/phone");
const retry_on_deadlock_1 = require("../../../shared/retry-on-deadlock");
const lead_intake_service_1 = require("../../crm/leads/lead-intake.service");
const shared_1 = require("@espartanos/shared");
const google_calendar_service_1 = require("../../integrations/google/google-calendar.service");
const meta_conversion_outbox_service_1 = require("../../integrations/meta/meta-conversion-outbox.service");
const notification_service_1 = require("../../../core/notifications/notification.service");
const email_service_1 = require("../../../core/notifications/email.service");
const audit_service_1 = require("../../../core/audit/audit.service");
const meta_client_pixel_service_1 = require("../../integrations/meta/meta-client-pixel.service");
const geo_inference_1 = require("../../../shared/geo-inference");
const google_conversion_outbox_service_1 = require("../../integrations/google/google-conversion-outbox.service");
const client_capabilities_1 = require("../../clients/client-capabilities");
const FIELD_TYPES = new Set(['text', 'textarea', 'email', 'phone', 'select', 'multi_select', 'number', 'date', 'consent', 'coupon', 'rating', 'nps']);
const CHOICE_FIELD_TYPES = ['select', 'multi_select'];
const CONTACT_REQUEST_STATUSES = ['pending', 'contacted', 'resolved'];
const ACTIVE_STATUSES = ['pending', 'confirmed', 'rescheduled'];
const STATUS_TRANSITIONS = {
    pending: ['confirmed', 'cancelled_client', 'cancelled_business', 'waitlist'],
    confirmed: ['rescheduled', 'cancelled_client', 'cancelled_business', 'attended', 'no_show'],
    rescheduled: ['confirmed', 'cancelled_client', 'cancelled_business', 'attended', 'no_show'],
    waitlist: ['confirmed', 'cancelled_client', 'cancelled_business'],
    attended: [], no_show: [], cancelled_client: [], cancelled_business: [],
};
let ReservationsService = ReservationsService_1 = class ReservationsService {
    constructor(forms, reservations, blocks, events, formEvents, coupons, dataSource, leadIntake, calendar, metaOutbox, clientPixels, notifications, emails, audit, googleOutbox, surveyContacts, reservationCatalog) {
        this.forms = forms;
        this.reservations = reservations;
        this.blocks = blocks;
        this.events = events;
        this.formEvents = formEvents;
        this.coupons = coupons;
        this.dataSource = dataSource;
        this.leadIntake = leadIntake;
        this.calendar = calendar;
        this.metaOutbox = metaOutbox;
        this.clientPixels = clientPixels;
        this.notifications = notifications;
        this.emails = emails;
        this.audit = audit;
        this.googleOutbox = googleOutbox;
        this.surveyContacts = surveyContacts;
        this.reservationCatalog = reservationCatalog;
        this.logger = new common_1.Logger(ReservationsService_1.name);
    }
    slug(value) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 140); }
    scope(organizationId, clientId, clientIds) { return { organizationId, ...(clientId ? { clientId } : clientIds !== undefined ? { clientId: (0, typeorm_2.In)(clientIds) } : {}) }; }
    sqlClientScope(clientId, clientIds) {
        if (clientId)
            return { clause: ' AND client_id = ?', params: [clientId] };
        if (clientIds === undefined)
            return { clause: '', params: [] };
        if (clientIds.length === 0)
            return { clause: ' AND 1 = 0', params: [] };
        return { clause: ` AND client_id IN (${clientIds.map(() => '?').join(',')})`, params: clientIds };
    }
    minutes(value) { const match = /^(\d{2}):(\d{2})$/.exec(value); if (!match)
        return -1; const total = Number(match[1]) * 60 + Number(match[2]); return Number(match[1]) < 24 && Number(match[2]) < 60 ? total : -1; }
    overlaps(aStart, aEnd, bStart, bEnd) { return aStart < bEnd && aEnd > bStart; }
    minutesOverlaps(aStartMin, aEndMin, bStartMin, bEndMin) { return aStartMin < bEndMin && aEndMin > bStartMin; }
    configs(form) { return { services: (form.servicesConfig || []), resources: (form.resourcesConfig || []) }; }
    validateConfiguration(form) {
        (0, timezone_1.assertTimeZone)(form.timezone);
        const fields = form.fieldSchema;
        if (!Array.isArray(fields) || fields.length === 0 || fields.length > 80)
            throw new common_1.BadRequestException('El formulario debe contener entre 1 y 80 campos');
        const fieldIds = new Set();
        for (const field of fields) {
            if (!field || typeof field.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(field.id) || fieldIds.has(field.id))
                throw new common_1.BadRequestException('Los campos deben tener identificadores únicos y válidos');
            if (!FIELD_TYPES.has(field.type) || typeof field.label !== 'string' || !field.label.trim() || field.label.length > 180)
                throw new common_1.BadRequestException(`Configuración inválida en el campo ${field.id}`);
            if (['select', 'multi_select'].includes(field.type) && (!Array.isArray(field.options) || field.options.length < 1 || field.options.length > 100))
                throw new common_1.BadRequestException(`El campo ${field.id} requiere opciones válidas`);
            if (field.options && (new Set(field.options).size !== field.options.length || field.options.some((option) => typeof option !== 'string' || !option.trim() || option.length > 180)))
                throw new common_1.BadRequestException(`El campo ${field.id} contiene opciones inválidas o duplicadas`);
            fieldIds.add(field.id);
        }
        if (!fields.some((field) => field.id === 'name' && field.required))
            throw new common_1.BadRequestException('El nombre debe permanecer como campo obligatorio');
        if (!fields.some((field) => field.type === 'consent' && field.required))
            throw new common_1.BadRequestException('El formulario requiere una aceptación de tratamiento de datos');
        const validateWindows = (windows, label) => {
            if (!Array.isArray(windows) || windows.length > 40)
                throw new common_1.BadRequestException(`${label} no es válida`);
            for (const window of windows)
                if (!Number.isInteger(window.day) || window.day < 0 || window.day > 6 || this.minutes(window.start) < 0 || this.minutes(window.end) <= this.minutes(window.start))
                    throw new common_1.BadRequestException(`Existe una ventana horaria inválida en ${label}`);
            for (let day = 0; day <= 6; day++) {
                const dayWindows = windows.filter((window) => window.day === day).sort((a, b) => this.minutes(a.start) - this.minutes(b.start));
                for (let previous = dayWindows[0], i = 1; i < dayWindows.length; i++) {
                    const current = dayWindows[i];
                    if (this.minutesOverlaps(this.minutes(previous.start), this.minutes(previous.end), this.minutes(current.start), this.minutes(current.end)))
                        throw new common_1.BadRequestException(`Ventanas de ${label} se superponen`);
                    previous = current;
                }
            }
        };
        const validateWindowsIfPresent = (windows, label) => { if (windows !== undefined && windows !== null)
            validateWindows(windows, label); };
        const windows = form.scheduleConfig?.windows;
        validateWindowsIfPresent(windows, 'La agenda semanal');
        for (const collection of [form.servicesConfig || [], form.resourcesConfig || []]) {
            const ids = new Set();
            for (const item of collection) {
                if (typeof item?.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 180)
                    throw new common_1.BadRequestException('Servicios y recursos requieren ID y nombre únicos');
                if (item.durationMinutes !== undefined && (!Number.isInteger(item.durationMinutes) || Number(item.durationMinutes) < 5 || Number(item.durationMinutes) > 1440))
                    throw new common_1.BadRequestException('La duración del servicio no es válida');
                if (item.capacity !== undefined && (!Number.isInteger(item.capacity) || Number(item.capacity) < 1 || Number(item.capacity) > 500))
                    throw new common_1.BadRequestException('La capacidad del servicio o recurso no es válida');
                if (item.windows !== undefined && item.windows !== null)
                    validateWindowsIfPresent(item.windows, `La agenda de ${item.name}`);
                ids.add(item.id);
            }
        }
        const design = form.designConfig;
        for (const color of [design.primaryColor, design.accentColor, design.backgroundColor, design.textColor].filter(Boolean))
            if (!/^#[0-9a-fA-F]{6}$/.test(color))
                throw new common_1.BadRequestException('Los colores deben usar formato hexadecimal');
        if (design.title && design.title.length > 180 || design.welcome && design.welcome.length > 1200 || design.confirmationMessage && design.confirmationMessage.length > 1200)
            throw new common_1.BadRequestException('Los textos de diseño exceden el largo permitido');
        if (design.backgroundMode && !['color', 'gradient', 'image'].includes(design.backgroundMode))
            throw new common_1.BadRequestException('El tipo de fondo no es válido');
        if (design.backgroundGradient && (design.backgroundGradient.length > 500 || !/^linear-gradient\(/i.test(design.backgroundGradient.trim())))
            throw new common_1.BadRequestException('El degradado de fondo no es válido');
        if (design.backgroundOpacity !== undefined && (!Number.isFinite(Number(design.backgroundOpacity)) || Number(design.backgroundOpacity) < 0 || Number(design.backgroundOpacity) > 100))
            throw new common_1.BadRequestException('La opacidad de fondo no es válida');
        if (design.backgroundPosition && !['center', 'top', 'bottom', 'left', 'right'].includes(design.backgroundPosition))
            throw new common_1.BadRequestException('La posición del fondo no es válida');
        if (design.buttonRadius !== undefined && (!Number.isFinite(Number(design.buttonRadius)) || Number(design.buttonRadius) < 0 || Number(design.buttonRadius) > 999))
            throw new common_1.BadRequestException('La forma de botones no es válida');
        if (design.fieldRadius !== undefined && (!Number.isFinite(Number(design.fieldRadius)) || Number(design.fieldRadius) < 0 || Number(design.fieldRadius) > 80))
            throw new common_1.BadRequestException('La forma de campos no es válida');
        if (design.fontFamily && (design.fontFamily.length > 120 || /[;{}]/.test(design.fontFamily)))
            throw new common_1.BadRequestException('La tipografía no es válida');
        const isValidImageUrl = (url) => !url || (/^https:\/\//i.test(url) && url.length <= 2048);
        if (!isValidImageUrl(design.logoUrl))
            throw new common_1.BadRequestException('El logo debe usar una URL HTTPS válida');
        if (!isValidImageUrl(design.backgroundImage))
            throw new common_1.BadRequestException('La imagen de fondo debe usar una URL HTTPS válida');
    }
    validateAnswers(form, answers) {
        const fields = form.fieldSchema.filter((f) => f.type !== 'coupon');
        const byId = new Map(fields.map((field) => [field.id, field]));
        const keys = Object.keys(answers);
        if (keys.length > fields.length || keys.some((key) => !byId.has(key)))
            throw new common_1.BadRequestException('Las respuestas contienen campos no publicados');
        for (const [key, value] of Object.entries(answers)) {
            const field = byId.get(key);
            if (typeof value === 'string' && value.length > 5000)
                throw new common_1.BadRequestException(`La respuesta de ${field.label} es demasiado extensa`);
            if (Array.isArray(value) && (value.length > 100 || value.some((entry) => typeof entry !== 'string' || entry.length > 500)))
                throw new common_1.BadRequestException(`La respuesta de ${field.label} no es válida`);
            if (field.type === 'number' && (typeof value !== 'number' && typeof value !== 'string' || !Number.isFinite(Number(value))))
                throw new common_1.BadRequestException(`La respuesta de ${field.label} debe ser numérica`);
            if (field.type === 'rating' && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 5))
                throw new common_1.BadRequestException(`La respuesta de ${field.label} debe estar entre 1 y 5`);
            if (field.type === 'consent' && typeof value !== 'boolean')
                throw new common_1.BadRequestException(`La respuesta de ${field.label} debe ser una aceptación`);
        }
    }
    validateSubmission(form, answers, guest) {
        this.validateAnswers(form, answers);
        for (const field of form.fieldSchema) {
            const value = field.id === 'name' ? guest.guestName : field.id === 'email' ? guest.guestEmail : field.id === 'phone' ? guest.guestPhone : answers[field.id];
            const empty = value == null || value === '' || value === false || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0);
            if (field.required && empty)
                throw new common_1.BadRequestException(`Falta completar ${field.label}`);
            if (empty)
                continue;
            if (field.type === 'select' && field.options && !field.options.includes(String(value)))
                throw new common_1.BadRequestException(`Respuesta inválida en ${field.label}`);
            if (field.type === 'multi_select' && field.options && (!Array.isArray(value) || value.some((entry) => !field.options.includes(String(entry)))))
                throw new common_1.BadRequestException(`Respuesta inválida en ${field.label}`);
            if (field.type === 'email' && typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
                throw new common_1.BadRequestException(`Correo inválido en ${field.label}`);
        }
    }
    async assertClientOwnership(organizationId, clientId) {
        const rows = await this.dataSource.query('SELECT id FROM clients WHERE id = ? AND organization_id = ? LIMIT 1', [clientId, organizationId]);
        if (!Array.isArray(rows) || rows.length === 0)
            throw new common_1.ForbiddenException('El cliente no pertenece a esta organización');
    }
    transaction(operation, work) {
        return (0, retry_on_deadlock_1.retryOnDeadlock)(operation, () => this.dataSource.transaction(work));
    }
    async clientCapabilities(organizationId, clientId, queryFn) {
        const q = queryFn || this.dataSource.query.bind(this.dataSource);
        const rows = await q('SELECT capabilities FROM clients WHERE id = ? AND organization_id = ? LIMIT 1', [clientId, organizationId]);
        if (!Array.isArray(rows) || rows.length === 0)
            throw new common_1.ForbiddenException('El cliente no pertenece a esta organización');
        const raw = rows[0]?.capabilities;
        let parsed;
        try {
            parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        }
        catch (err) {
            this.logger.warn(`Client capabilities invalid JSON for ${clientId}: ${err instanceof Error ? err.message : err}`);
            parsed = undefined;
        }
        return (0, client_capabilities_1.normalizeClientCapabilities)(parsed);
    }
    async uniqueSlug(baseValue) {
        const base = this.slug(baseValue) || 'reservas';
        let candidate = base;
        while (await this.forms.exist({ where: { publicSlug: candidate } }))
            candidate = `${base}-${(0, crypto_1.randomBytes)(3).toString('hex')}`;
        return candidate;
    }
    async createForm(organizationId, userId, dto) {
        await this.assertClientOwnership(organizationId, dto.clientId);
        const capabilities = await this.clientCapabilities(organizationId, dto.clientId);
        if (!capabilities.reservations)
            throw new common_1.ForbiddenException('Reservas no está habilitado para esta empresa');
        const isSurvey = ['request', 'survey'].includes(dto.mode || '');
        const fieldSchema = isSurvey
            ? [
                { id: 'name', type: 'text', label: 'Nombre', required: true, system: true, placeholder: 'Nombre completo' },
                { id: 'email', type: 'email', label: 'Email (aquí enviaremos tu regalo)', required: true, system: true, placeholder: 'Email' },
                { id: 'phone', type: 'phone', label: 'WhatsApp', required: true, system: true, placeholder: '+56 9 ...' },
                { id: 'birthday', type: 'date', label: '¿Cuál es tu fecha de cumpleaños?', required: true },
                { id: 'consent', type: 'consent', label: 'Acepto los términos y condiciones proporcionados por la empresa. Al proporcionar mi número de WhatsApp acepto recibir promociones esporádicas.', required: true },
                { id: 'ad_influenced', type: 'select', label: '¿Viste algún anuncio publicitario que influyó en tu decisión de visitarnos?', required: true, options: ['Sí', 'No'] },
                { id: 'source', type: 'select', label: '¿Cómo nos conociste?', required: true, options: ['Recomendación de alguien', 'Vi un anuncio publicitario en Facebook/Instagram', 'Los vi mientras caminaba y entré', 'Ya los conocía, soy cliente'] },
                { id: 'served_by', type: 'text', label: '¿Podrías indicarnos quien te atendió durante tu visita?', required: true, placeholder: 'Ej: Juan' },
                { id: 'rating', type: 'rating', label: 'De 1 a 5 ¿Cómo calificarías la experiencia?', required: true },
            ]
            : [{ id: 'name', type: 'text', label: 'Nombre completo', required: true, system: true }, { id: 'email', type: 'email', label: 'Correo', required: false, system: true }, { id: 'phone', type: 'phone', label: 'Teléfono', required: true, system: true }, { id: 'consent', type: 'consent', label: 'Acepto el tratamiento de mis datos para gestionar esta reserva.', required: true }];
        const form = this.forms.create({
            organizationId, clientId: dto.clientId, createdBy: userId, name: dto.name.trim(), publicSlug: await this.uniqueSlug(dto.publicSlug || dto.name), mode: dto.mode || 'appointment', rubro: dto.rubro ?? null, tipo: dto.tipo ?? null,
            fieldSchema,
            designConfig: isSurvey
                ? { primaryColor: '#1f5b2d', accentColor: '#d79b3a', backgroundColor: '#f5eedf', textColor: '#263241', title: dto.name, welcome: 'Gracias por ser parte de nuestra experiencia. Tu opinión es fundamental para seguir mejorando.', confirmationMessage: 'Gracias por tu tiempo. Tu respuesta fue registrada.', backgroundMode: 'image', backgroundOpacity: '82', backgroundPosition: 'center', backgroundSize: 'cover', layoutPosition: 'center', buttonRadius: '6', fieldRadius: '6', fontFamily: 'Inter, sans-serif', showFacts: 'false', showSecureBadge: 'false', showPoweredBy: 'false', googleReviewUrl: '', googleReviewMinRating: '4' }
                : { primaryColor: '#173f35', accentColor: '#ea0f63', backgroundColor: '#f3f5ef', textColor: '#3f4e49', title: dto.name, welcome: 'Elige el horario que mejor te acomode.', backgroundMode: 'gradient', backgroundGradient: 'linear-gradient(135deg, #f3f5ef 0%, #dce9df 100%)', backgroundOpacity: '88', backgroundPosition: 'center', buttonRadius: '12', fieldRadius: '10', fontFamily: 'system-ui' },
            scheduleConfig: { windows: [1, 2, 3, 4, 5].map((day) => ({ day, start: '09:00', end: '18:00' })) }, servicesConfig: [], resourcesConfig: [], crmEnabled: capabilities.crm, calendarEnabled: false, metaCapiEnabled: false,
        });
        this.validateConfiguration(form);
        return this.forms.save(form);
    }
    listForms(organizationId, clientId, clientIds) { return this.forms.find({ where: this.scope(organizationId, clientId, clientIds), order: { updatedAt: 'DESC' } }); }
    async getForm(organizationId, id, clientId, clientIds) { const form = await this.forms.findOne({ where: { id, ...this.scope(organizationId, clientId, clientIds) } }); if (!form)
        throw new common_1.NotFoundException('Formulario no encontrado'); return form; }
    async updateForm(organizationId, id, dto, clientId, clientIds) {
        const form = await this.getForm(organizationId, id, clientId, clientIds);
        const capabilities = await this.clientCapabilities(organizationId, form.clientId);
        if (!capabilities.reservations)
            throw new common_1.ForbiddenException('Reservas no está habilitado para esta empresa');
        if (dto.crmEnabled && !capabilities.crm)
            throw new common_1.BadRequestException('CRM no está habilitado para esta empresa');
        if (dto.metaCapiEnabled && !capabilities.metaConversions)
            throw new common_1.BadRequestException('Meta Pixel + CAPI no está habilitado para esta empresa');
        Object.assign(form, Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)));
        if (!capabilities.crm)
            form.crmEnabled = false;
        if (!capabilities.metaConversions)
            form.metaCapiEnabled = false;
        this.validateConfiguration(form);
        if (form.status === 'published' && (form.scheduleConfig.windows?.length || 0) === 0)
            throw new common_1.BadRequestException('No puedes publicar sin disponibilidad');
        return this.forms.save(form);
    }
    async duplicateForm(organizationId, id, userId, clientIds) { const source = await this.getForm(organizationId, id, undefined, clientIds); const copy = this.forms.create({ ...source, id: undefined, name: `${source.name} (copia)`, publicSlug: await this.uniqueSlug(source.publicSlug), status: 'draft', createdBy: userId, createdAt: undefined, updatedAt: undefined }); return this.forms.save(copy); }
    async addBlock(organizationId, formId, userId, dto, clientId, clientIds) { const form = await this.getForm(organizationId, formId, clientId, clientIds); const startsAt = new Date(dto.startsAt); const endsAt = new Date(dto.endsAt); if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt)
        throw new common_1.BadRequestException('El fin debe ser posterior al inicio'); if (endsAt.getTime() - startsAt.getTime() > 366 * 86400000)
        throw new common_1.BadRequestException('Un bloqueo no puede superar 366 días'); return this.blocks.save(this.blocks.create({ organizationId, clientId: form.clientId, formId, createdBy: userId, startsAt, endsAt, reason: dto.reason })); }
    async listBlocks(organizationId, formId, clientId, clientIds) { await this.getForm(organizationId, formId, clientId, clientIds); return this.blocks.find({ where: { organizationId, formId }, order: { startsAt: 'ASC' } }); }
    async removeBlock(organizationId, id, clientId, clientIds, actorId) { const block = await this.blocks.findOne({ where: { id, ...this.scope(organizationId, clientId, clientIds) } }); if (!block)
        throw new common_1.NotFoundException('Bloqueo no encontrado'); await this.blocks.remove(block); await this.audit.log({ organizationId, actorId, entityType: 'AvailabilityBlock', entityId: id, action: 'deleted', before: { startsAt: block.startsAt, endsAt: block.endsAt, reason: block.reason, formId: block.formId } }); return { deleted: true }; }
    async publishedForm(slug, manager, lock = false) {
        const repo = manager?.getRepository(reservation_form_entity_1.ReservationForm) || this.forms;
        const qb = repo.createQueryBuilder('form').where('form.public_slug = :slug AND form.status = :status', { slug, status: 'published' });
        if (lock)
            qb.setLock('pessimistic_write');
        const form = await qb.getOne();
        if (!form)
            throw new common_1.NotFoundException('Este formulario no está disponible');
        const capabilities = await this.clientCapabilities(form.organizationId, form.clientId, manager?.query.bind(manager));
        if (!capabilities.reservations)
            throw new common_1.NotFoundException('Este formulario no está disponible');
        try {
            this.validateConfiguration(form);
        }
        catch (err) {
            this.logger.error(`Formulario publicado ${form.id} (${slug}) tiene configuración inválida: ${err instanceof Error ? err.message : err}`);
            throw new common_1.NotFoundException('Este formulario no está disponible');
        }
        return form;
    }
    async publicForm(slug) {
        const form = await this.publishedForm(slug);
        const capabilities = await this.clientCapabilities(form.organizationId, form.clientId);
        const meta = capabilities.metaConversions
            ? await this.getClientMetaConfig(form.clientId, form.organizationId)
            : { pixelId: '', pixelName: null, accessToken: undefined };
        return { name: form.name, publicSlug: form.publicSlug, mode: form.mode, timezone: form.timezone, durationMinutes: form.durationMinutes, capacityPerSlot: form.capacityPerSlot, confirmationMode: form.confirmationMode, fieldSchema: form.fieldSchema.filter((field) => !field.internal), designConfig: form.designConfig, servicesConfig: form.servicesConfig, resourcesConfig: form.resourcesConfig, pixelId: meta.pixelId, pixelName: meta.pixelName || null, metaReady: Boolean(meta.pixelId && meta.accessToken), ga4MeasurementId: form.ga4MeasurementId || null };
    }
    async formContext(organizationId, clientId) {
        const capabilities = await this.clientCapabilities(organizationId, clientId);
        const { pixelId, pixelName, accessToken } = capabilities.metaConversions ? await this.getClientMetaConfig(clientId, organizationId) : { pixelId: '', pixelName: null, accessToken: undefined };
        return { capabilities, pixelId: pixelId || null, pixelName: pixelName || null, metaReady: Boolean(pixelId && accessToken) };
    }
    effectiveRules(form, serviceId, resourceId) {
        const { services, resources } = this.configs(form);
        const service = serviceId ? services.find((item) => item.id === serviceId) : undefined;
        const resource = resourceId ? resources.find((item) => item.id === resourceId) : undefined;
        if (serviceId && !service)
            throw new common_1.BadRequestException('Servicio inválido');
        if (resourceId && !resource)
            throw new common_1.BadRequestException('Recurso inválido');
        return { duration: service?.durationMinutes || form.durationMinutes, capacity: Math.max(1, Math.min(service?.capacity || form.capacityPerSlot, resource?.capacity || form.capacityPerSlot)), windows: resource?.windows || (form.scheduleConfig.windows), service, resource };
    }
    assertScheduled(form, startsAt, serviceId, resourceId) {
        const rules = this.effectiveRules(form, serviceId, resourceId);
        const local = (0, timezone_1.zonedParts)(startsAt, form.timezone);
        const minute = local.hour * 60 + local.minute;
        const window = rules.windows.find((item) => item.day === local.weekday && minute >= this.minutes(item.start) && minute + rules.duration <= this.minutes(item.end));
        if (!window || (minute - this.minutes(window.start)) % (rules.duration + form.bufferMinutes) !== 0)
            throw new common_1.BadRequestException('El horario no pertenece a la disponibilidad publicada');
        const now = Date.now();
        if (startsAt.getTime() < now + form.minimumNoticeHours * 3600000 || startsAt.getTime() > now + form.maximumAdvanceDays * 86400000)
            throw new common_1.BadRequestException('El horario está fuera del rango permitido');
        return rules;
    }
    localDateKey(date, timeZone) {
        const { year, month, day } = (0, timezone_1.zonedParts)(date, timeZone);
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    async getClientMetaConfig(clientId, organizationId) {
        return this.clientPixels.resolve(organizationId, clientId);
    }
    async createManual(organizationId, userId, dto, clientId, clientIds, notify = true) {
        const form = await this.getForm(organizationId, dto.formId, clientId, clientIds);
        const startsAt = new Date(dto.startsAt);
        if (Number.isNaN(startsAt.getTime()))
            throw new common_1.BadRequestException('Fecha inválida');
        this.validateEmailDomain(dto.guestEmail);
        const guestName = dto.guestName.trim();
        if (!guestName)
            throw new common_1.BadRequestException('El nombre es obligatorio');
        const partySize = dto.partySize || 1;
        const result = await this.transaction('crear reserva manual', async (manager) => {
            await manager.getRepository(reservation_form_entity_1.ReservationForm).createQueryBuilder('f').setLock('pessimistic_write').where('f.id = :id', { id: form.id }).getOne();
            let endsAt;
            if (dto.skipAvailability) {
                const rules = this.effectiveRules(form, dto.serviceId, dto.resourceId);
                endsAt = new Date(startsAt.getTime() + rules.duration * 60000);
            }
            else {
                const available = await this.availability(manager, form, startsAt, partySize, dto.serviceId, dto.resourceId);
                endsAt = available.endsAt;
            }
            const booking = await manager.save(reservation_entity_1.Reservation, manager.create(reservation_entity_1.Reservation, {
                organizationId, clientId: form.clientId, formId: form.id, referenceCode: (0, crypto_1.randomBytes)(6).toString('hex').toUpperCase(),
                status: 'confirmed', startsAt, endsAt, partySize,
                guestName, guestEmail: dto.guestEmail?.trim().toLowerCase(), guestPhone: (0, phone_1.normalizePhone)(dto.guestPhone),
                serviceId: dto.serviceId, resourceId: dto.resourceId, answers: dto.answers || {}, internalNotes: dto.internalNotes,
            }));
            await manager.save(reservation_event_entity_1.ReservationEvent, manager.create(reservation_event_entity_1.ReservationEvent, { organizationId, clientId: form.clientId, reservationId: booking.id, type: 'created', toStatus: 'confirmed', actorId: userId, actorType: 'team', metadata: { startsAt: startsAt.toISOString(), serviceId: dto.serviceId, resourceId: dto.resourceId, manual: true, skipAvailability: dto.skipAvailability } }));
            return { booking, form };
        });
        if (notify)
            await this.notifyNewBooking(result.form, result.booking);
        return result.booking;
    }
    async dailyReservationsCount(manager, formId, dateKey, timeZone, excludeId) {
        const start = (0, timezone_1.startOfLocalDayUtc)(dateKey, timeZone);
        const end = (0, timezone_1.startOfLocalDayUtc)((0, timezone_1.addPlainDays)(dateKey, 1), timeZone);
        const qb = manager.getRepository(reservation_entity_1.Reservation).createQueryBuilder('r')
            .where('r.form_id = :formId AND r.starts_at >= :start AND r.starts_at < :end AND r.status IN (:...statuses)', { formId, start, end, statuses: ACTIVE_STATUSES });
        if (excludeId)
            qb.andWhere('r.id != :excludeId', { excludeId });
        return qb.getCount();
    }
    async clientDailyReservationsCount(manager, clientId, dateKey, timeZone, excludeId) {
        const start = (0, timezone_1.startOfLocalDayUtc)(dateKey, timeZone);
        const end = (0, timezone_1.startOfLocalDayUtc)((0, timezone_1.addPlainDays)(dateKey, 1), timeZone);
        const qb = manager.getRepository(reservation_entity_1.Reservation).createQueryBuilder('r')
            .where('r.client_id = :clientId AND r.starts_at >= :start AND r.starts_at < :end AND r.status IN (:...statuses)', { clientId, start, end, statuses: ACTIVE_STATUSES });
        if (excludeId)
            qb.andWhere('r.id != :excludeId', { excludeId });
        return qb.getCount();
    }
    async clientTimezone(clientId, organizationId) {
        const form = await this.forms.findOne({
            where: { clientId, organizationId },
            select: { id: true, timezone: true },
        });
        return form?.timezone || 'America/Santiago';
    }
    async clientDailyCap(runner, clientId) {
        const rows = await runner.query('SELECT daily_reservation_cap FROM clients WHERE id = ?', [clientId]);
        return Number(rows?.[0]?.daily_reservation_cap ?? 0) || 0;
    }
    async availability(manager, form, startsAt, partySize, serviceId, resourceId, excludeId) {
        const rules = this.assertScheduled(form, startsAt, serviceId, resourceId);
        const endsAt = new Date(startsAt.getTime() + rules.duration * 60000);
        const block = await manager.getRepository(availability_block_entity_1.AvailabilityBlock).createQueryBuilder('b').where('b.form_id = :formId AND b.starts_at < :endsAt AND b.ends_at > :startsAt', { formId: form.id, startsAt, endsAt }).getOne();
        if (block)
            throw new common_1.ConflictException('El horario está bloqueado');
        const dateKey = this.localDateKey(startsAt, form.timezone);
        if (form.dailyCapacity > 0) {
            const dailyCount = await this.dailyReservationsCount(manager, form.id, dateKey, form.timezone, excludeId);
            if (dailyCount >= form.dailyCapacity)
                throw new common_1.ConflictException('Este día ya alcanzó su tope de reservas');
        }
        const clientCap = await this.clientDailyCap(manager, form.clientId);
        if (clientCap > 0) {
            const clientCount = await this.clientDailyReservationsCount(manager, form.clientId, dateKey, form.timezone, excludeId);
            if (clientCount >= clientCap)
                throw new common_1.ConflictException('Este día ya alcanzó su tope de reservas');
        }
        const qb = manager.getRepository(reservation_entity_1.Reservation).createQueryBuilder('r').where('r.form_id = :formId AND r.starts_at < :endsAt AND r.ends_at > :startsAt AND r.status IN (:...statuses)', { formId: form.id, startsAt, endsAt, statuses: ACTIVE_STATUSES }).setLock('pessimistic_write');
        if (resourceId)
            qb.andWhere('r.resource_id = :resourceId', { resourceId });
        if (excludeId)
            qb.andWhere('r.id != :excludeId', { excludeId });
        const existing = await qb.getMany();
        const used = existing.reduce((sum, item) => sum + item.partySize, 0);
        if (used + partySize > rules.capacity)
            throw new common_1.ConflictException('Ese horario acaba de ocuparse. Selecciona una alternativa.');
        return { ...rules, endsAt, available: rules.capacity - used };
    }
    async slots(slug, from, days = 14, serviceId, resourceId) {
        const form = await this.publishedForm(slug);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from))
            throw new common_1.BadRequestException('Fecha inválida');
        if (!Number.isInteger(days) || days < 1 || days > 31)
            throw new common_1.BadRequestException('El rango debe contener entre 1 y 31 días');
        const rules = this.effectiveRules(form, serviceId, resourceId);
        const count = days;
        const rangeStart = (0, timezone_1.startOfLocalDayUtc)(from, form.timezone);
        const rangeEnd = (0, timezone_1.startOfLocalDayUtc)((0, timezone_1.addPlainDays)(from, count), form.timezone);
        const existingQb = this.reservations.createQueryBuilder('r')
            .select(['r.id', 'r.startsAt', 'r.endsAt', 'r.partySize'])
            .where('r.form_id = :formId AND r.starts_at >= :start AND r.starts_at < :end AND r.status IN (:...statuses)', { formId: form.id, start: rangeStart, end: rangeEnd, statuses: ACTIVE_STATUSES });
        if (resourceId)
            existingQb.andWhere('r.resource_id = :resourceId', { resourceId });
        const blocksQb = this.blocks.createQueryBuilder('b')
            .select(['b.id', 'b.startsAt', 'b.endsAt'])
            .where('b.form_id = :formId AND b.starts_at < :end AND b.ends_at > :start', { formId: form.id, start: rangeStart, end: rangeEnd });
        const [existing, blocks] = await Promise.all([existingQb.getMany(), blocksQb.getMany()]);
        const clientCap = await this.clientDailyCap(this.dataSource, form.clientId);
        const clientCounts = new Map();
        if (clientCap > 0) {
            const clientRows = await this.reservations.createQueryBuilder('r')
                .where('r.client_id = :clientId AND r.starts_at >= :start AND r.starts_at < :end AND r.status IN (:...statuses)', { clientId: form.clientId, start: rangeStart, end: rangeEnd, statuses: ACTIVE_STATUSES })
                .getMany();
            for (const item of clientRows) {
                const key = this.localDateKey(item.startsAt, form.timezone);
                clientCounts.set(key, (clientCounts.get(key) ?? 0) + 1);
            }
        }
        const dailyCounts = new Map();
        const reservationsByDate = new Map();
        const blocksByDate = new Map();
        if (form.dailyCapacity > 0) {
            for (const item of existing) {
                const key = this.localDateKey(item.startsAt, form.timezone);
                dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
            }
        }
        for (const item of existing) {
            const key = this.localDateKey(item.startsAt, form.timezone);
            const list = reservationsByDate.get(key) || [];
            list.push(item);
            reservationsByDate.set(key, list);
        }
        const lastRequestedDate = (0, timezone_1.addPlainDays)(from, count - 1);
        for (const block of blocks) {
            const startKey = this.localDateKey(block.startsAt, form.timezone);
            const endKey = this.localDateKey(block.endsAt, form.timezone);
            const firstKey = startKey < from ? from : startKey;
            const lastKey = endKey > lastRequestedDate ? lastRequestedDate : endKey;
            for (let key = firstKey; key <= lastKey; key = (0, timezone_1.addPlainDays)(key, 1)) {
                const list = blocksByDate.get(key) || [];
                list.push(block);
                blocksByDate.set(key, list);
            }
        }
        const result = [];
        const windowsByWeekday = new Map();
        for (const window of rules.windows) {
            const list = windowsByWeekday.get(window.day) || [];
            list.push(window);
            windowsByWeekday.set(window.day, list);
        }
        const minStart = Date.now() + form.minimumNoticeHours * 3600000;
        const maxStart = Date.now() + form.maximumAdvanceDays * 86400000;
        const fullDays = [];
        for (let offset = 0; offset < count; offset += 1) {
            const date = (0, timezone_1.addPlainDays)(from, offset);
            const { weekday } = (0, timezone_1.plainDateParts)(date);
            const dayWindows = windowsByWeekday.get(weekday) || [];
            const formFull = form.dailyCapacity > 0 && (dailyCounts.get(date) ?? 0) >= form.dailyCapacity;
            const clientFull = clientCap > 0 && (clientCounts.get(date) ?? 0) >= clientCap;
            if (formFull || clientFull) {
                if (dayWindows.length > 0)
                    fullDays.push(date);
                continue;
            }
            const dayReservations = reservationsByDate.get(date) || [];
            const dayBlocks = blocksByDate.get(date) || [];
            for (const window of dayWindows) {
                for (let minute = this.minutes(window.start); minute + rules.duration <= this.minutes(window.end); minute += rules.duration + form.bufferMinutes) {
                    const startsAt = (0, timezone_1.tryLocalToUtc)(date, `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`, form.timezone);
                    if (!startsAt)
                        continue;
                    const endsAt = new Date(startsAt.getTime() + rules.duration * 60000);
                    if (startsAt.getTime() < minStart || startsAt.getTime() > maxStart)
                        continue;
                    if (dayBlocks.some((block) => this.overlaps(startsAt, endsAt, block.startsAt, block.endsAt)))
                        continue;
                    const used = dayReservations.reduce((sum, item) => this.overlaps(startsAt, endsAt, item.startsAt, item.endsAt) ? sum + item.partySize : sum, 0);
                    if (used < rules.capacity)
                        result.push({ startsAt: startsAt.toISOString(), available: rules.capacity - used });
                }
            }
        }
        return { slots: result, fullDays };
    }
    async trackPublicEvent(slug, dto) {
        const form = await this.publishedForm(slug);
        if (dto.sessionId) {
            const existing = await this.formEvents.findOne({ where: { formId: form.id, type: dto.type, sessionId: dto.sessionId } });
            if (existing)
                return existing;
        }
        return this.saveFormEventOnce(this.formEvents.create({ organizationId: form.organizationId, clientId: form.clientId, formId: form.id, type: dto.type, sessionId: dto.sessionId, utmSource: dto.utmSource, utmCampaign: dto.utmCampaign }));
    }
    async saveFormEventOnce(event) {
        try {
            return await this.formEvents.save(event);
        }
        catch (error) {
            if (error?.code !== 'ER_DUP_ENTRY')
                throw error;
            const existing = await this.formEvents.findOne({
                where: { formId: event.formId, type: event.type, sessionId: event.sessionId },
            });
            if (!existing)
                throw error;
            return existing;
        }
    }
    async createPublicSurveyResponse(slug, dto, ipAddress, userAgent, eventSourceUrl) {
        if (dto.website)
            throw new common_1.BadRequestException('Solicitud inválida');
        const form = await this.publishedForm(slug);
        if (!['request', 'survey'].includes(form.mode))
            throw new common_1.BadRequestException('Este enlace requiere selección de horario');
        this.validateSubmission(form, dto.answers, dto);
        this.validateEmailDomain(dto.guestEmail);
        const existing = await this.formEvents.findOne({ where: { formId: form.id, type: 'submit', sessionId: dto.idempotencyKey } });
        if (existing)
            return existing;
        const response = await this.saveFormEventOnce(this.formEvents.create({
            organizationId: form.organizationId,
            clientId: form.clientId,
            formId: form.id,
            type: 'submit',
            sessionId: dto.idempotencyKey,
            utmSource: dto.utmSource,
            utmCampaign: dto.utmCampaign,
            metadata: {
                guestName: dto.guestName.trim(),
                guestEmail: dto.guestEmail?.trim().toLowerCase(),
                guestPhone: (0, phone_1.normalizePhone)(dto.guestPhone),
                answers: dto.answers,
                clickId: dto.clickId,
                gclid: dto.gclid ?? dto.clickId,
                gbraid: dto.gbraid,
                wbraid: dto.wbraid,
                fbclid: dto.fbclid,
                fbc: dto.fbc,
                fbp: dto.fbp,
                clientIpAddress: ipAddress,
                clientUserAgent: userAgent,
            },
        }));
        const capabilities = await this.clientCapabilities(form.organizationId, form.clientId);
        if (form.metaCapiEnabled && capabilities.metaConversions) {
            try {
                await this.enqueueMetaSurveyConversion(response, form, dto, ipAddress, userAgent, eventSourceUrl);
            }
            catch (err) {
                this.logger.warn(`Meta CAPI survey enqueue failed for response ${response.id}: ${err instanceof Error ? err.message : err}`);
            }
        }
        await this.flagLowRatingSurvey(form, response, dto);
        return response;
    }
    async flagLowRatingSurvey(form, response, dto) {
        const fields = (form.fieldSchema ?? []);
        const ratingField = fields.find((field) => field.type === 'rating');
        const rawRating = ratingField ? dto.answers[ratingField.id] : undefined;
        const rating = typeof rawRating === 'string' && rawRating !== '' ? Number(rawRating) : typeof rawRating === 'number' ? rawRating : Number.NaN;
        if (!Number.isFinite(rating) || rating >= 4)
            return;
        const commentField = fields.find((field) => field.type === 'textarea' || field.type === 'text' || /comment|mensaje|message|opinion/i.test(field.id));
        const message = commentField ? String(dto.answers[commentField.id] ?? '').trim() : undefined;
        try {
            await this.surveyContacts.save(this.surveyContacts.create({
                organizationId: form.organizationId,
                clientId: form.clientId,
                formId: form.id,
                responseId: response.id,
                guestName: dto.guestName.trim(),
                email: dto.guestEmail?.trim().toLowerCase(),
                phone: dto.guestPhone ? (0, phone_1.normalizePhone)(dto.guestPhone) : undefined,
                message,
                rating: Math.round(rating),
                status: 'pending',
            }));
            await this.notifySurveyContact(form, dto.guestName.trim(), rating, message);
        }
        catch (err) {
            this.logger.warn(`Survey contact request failed for response ${response.id}: ${err instanceof Error ? err.message : err}`);
        }
    }
    async notifySurveyContact(form, guestName, rating, message) {
        try {
            const rows = await this.dataSource.query(`SELECT DISTINCT id FROM users WHERE organization_id = ? AND is_active = 1 AND (client_id = ? OR role IN ('admin', 'community_manager'))`, [form.organizationId, form.clientId]);
            const userIds = rows.map((row) => row.id).filter(Boolean);
            if (userIds.length > 0) {
                await this.notifications.notifyMultiple(form.organizationId, userIds, 'survey_low_rating', 'Encuesta con calificación baja', `${guestName} calificó con ${rating}/5 en ${form.name}. Revisa la respuesta y contacta a la persona.${message ? ` Mensaje: ${message}` : ''}`, { formId: form.id, clientId: form.clientId, responseId: undefined, rating });
            }
        }
        catch (err) {
            this.logger.warn(`Survey low rating notification failed: ${err instanceof Error ? err.message : err}`);
        }
    }
    async listSurveyContactRequests(organizationId, clientId) {
        return this.surveyContacts.find({
            where: { organizationId, ...(clientId ? { clientId } : {}) },
            order: { createdAt: 'DESC' },
            take: 200,
        });
    }
    async updateSurveyContactRequest(organizationId, id, body) {
        const row = await this.surveyContacts.findOne({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException('La solicitud de contacto no existe');
        if (body.status)
            row.status = body.status;
        if (body.notes !== undefined)
            row.notes = body.notes;
        if (body.status === 'resolved') {
            row.resolvedAt = new Date();
        }
        return this.surveyContacts.save(row);
    }
    validateEmailDomain(email) {
        if (!email)
            return;
        const domain = email.split('@')[1];
        if (!domain)
            return;
        void dns_1.promises.resolveMx(domain)
            .then((mx) => { if (!mx || mx.length === 0)
            this.reportBadEmail(domain); })
            .catch((err) => this.logger.warn(`MX lookup failed for domain ${domain}: ${err instanceof Error ? err.message : err}`));
    }
    reportBadEmail(_domain) {
        this.dataSource.query('INSERT INTO audit_logs (organization_id, entity_type, entity_id, action, metadata, occurred_at) VALUES (?, ?, ?, ?, ?, NOW())', [null, 'email_validation', _domain, 'mx_failed', JSON.stringify({ domain: _domain })]).catch(() => undefined);
    }
    async createPublic(slug, dto, ipAddress, userAgent, eventSourceUrl) {
        if (dto.website)
            throw new common_1.BadRequestException('Solicitud inválida');
        if (dto.renderedAt && Date.now() - new Date(dto.renderedAt).getTime() < 800)
            throw new common_1.BadRequestException('Completa el formulario antes de enviarlo');
        this.validateEmailDomain(dto.guestEmail);
        const result = await this.transaction('crear reserva publica', async (manager) => {
            const form = await this.publishedForm(slug, manager, true);
            const existingIdempotent = await manager.getRepository(reservation_entity_1.Reservation).findOne({ where: { formId: form.id, idempotencyKey: dto.idempotencyKey } });
            if (existingIdempotent)
                return { booking: existingIdempotent, form, created: false };
            const startsAt = new Date(dto.startsAt);
            if (Number.isNaN(startsAt.getTime()))
                throw new common_1.BadRequestException('Fecha inválida');
            const partySize = dto.partySize || 1;
            const availability = await this.availability(manager, form, startsAt, partySize, dto.serviceId, dto.resourceId);
            this.validateSubmission(form, dto.answers, dto);
            const coupon = await this.validateCoupon(dto.couponCode, form, manager, startsAt);
            if (coupon) {
                coupon.usageCount += 1;
                await manager.save(reservation_coupon_entity_1.ReservationCoupon, coupon);
            }
            const status = form.confirmationMode === 'manual' ? 'pending' : 'confirmed';
            const booking = await manager.save(reservation_entity_1.Reservation, manager.create(reservation_entity_1.Reservation, {
                organizationId: form.organizationId,
                clientId: form.clientId,
                formId: form.id,
                idempotencyKey: dto.idempotencyKey,
                referenceCode: (0, crypto_1.randomBytes)(6).toString('hex').toUpperCase(),
                status,
                startsAt,
                endsAt: availability.endsAt,
                partySize,
                guestName: dto.guestName.trim(),
                guestEmail: dto.guestEmail?.trim().toLowerCase(),
                guestPhone: (0, phone_1.normalizePhone)(dto.guestPhone),
                serviceId: dto.serviceId,
                resourceId: dto.resourceId,
                answers: dto.answers,
                consentVersion: dto.consentVersion,
                utmSource: dto.utmSource,
                utmMedium: dto.utmMedium,
                utmCampaign: dto.utmCampaign,
                utmContent: dto.utmContent,
                clickId: dto.clickId,
                gclid: dto.gclid ?? dto.clickId,
                gbraid: dto.gbraid,
                wbraid: dto.wbraid,
                fbclid: dto.fbclid,
                fbc: dto.fbc,
                fbp: dto.fbp,
                clientIpAddress: ipAddress,
                clientUserAgent: userAgent,
                couponCode: coupon?.code,
            }));
            await manager.save(reservation_event_entity_1.ReservationEvent, manager.create(reservation_event_entity_1.ReservationEvent, {
                organizationId: form.organizationId,
                clientId: form.clientId,
                reservationId: booking.id,
                type: 'created',
                toStatus: status,
                actorType: 'guest',
                metadata: { startsAt: startsAt.toISOString(), serviceId: dto.serviceId, resourceId: dto.resourceId },
            }));
            return { booking, form, created: true };
        });
        const capabilities = await this.clientCapabilities(result.form.organizationId, result.form.clientId);
        if (result.created && result.form.crmEnabled && capabilities.crm) {
            try {
                const { contact } = await this.leadIntake.captureAudience({
                    organizationId: result.form.organizationId,
                    clientId: result.form.clientId,
                    name: result.booking.guestName,
                    email: result.booking.guestEmail ?? undefined,
                    phone: result.booking.guestPhone ?? undefined,
                    source: shared_1.RESERVATION_LEAD_SOURCE,
                    sourceDetail: result.form.name,
                    status: 'reserved',
                    externalLeadId: `reservation:${result.booking.id}`,
                    externalFormId: result.form.id,
                    externalCampaignId: result.form.campaignId,
                    campaignName: result.booking.utmCampaign,
                    consentCapturedAt: new Date(),
                    metadata: {
                        reservationId: result.booking.id,
                        referenceCode: result.booking.referenceCode,
                        startsAt: result.booking.startsAt.toISOString(),
                    },
                });
                if (contact?.id && result.booking.contactId !== contact.id) {
                    result.booking.contactId = contact.id;
                    await this.reservations.update(result.booking.id, { contactId: contact.id });
                }
            }
            catch (err) {
                this.logger.warn(`CRM intake failed for booking ${result.booking.id}: ${err instanceof Error ? err.message : err}`);
                await this.recordIntegrationFailure(result.booking, 'crm');
            }
        }
        if (result.created && result.form.calendarEnabled) {
            const { form, booking } = result;
            void this.calendar.createEvent(form.organizationId, {
                summary: `${form.name}: ${booking.guestName}`,
                description: `Reserva ${booking.referenceCode}`,
                start: booking.startsAt,
                durationMinutes: Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60000),
            })
                .then((event) => this.reservations.update(booking.id, { calendarEventId: event.externalId, calendarUrl: event.calendarUrl }))
                .catch((err) => this.logger.warn(`Evento de calendario pendiente para la reserva ${booking.id}: ${err instanceof Error ? err.message : err}`));
        }
        if (result.created && result.form.metaCapiEnabled && capabilities.metaConversions) {
            try {
                await this.enqueueMetaConversion(result.booking, result.form, 'Schedule', Math.floor(result.booking.createdAt.getTime() / 1000), eventSourceUrl);
            }
            catch (err) {
                this.logger.warn(`Meta CAPI enqueue failed for booking ${result.booking.id}: ${err instanceof Error ? err.message : err}`);
                await this.recordIntegrationFailure(result.booking, 'meta_capi');
            }
        }
        if (result.created) {
            try {
                await this.enqueueGoogleConversion(result.booking, result.form, 'schedule', result.booking.createdAt);
            }
            catch (err) {
                this.logger.warn(`Google Ads enqueue failed for booking ${result.booking.id}: ${err instanceof Error ? err.message : err}`);
                await this.recordIntegrationFailure(result.booking, 'google_ads');
            }
        }
        if (result.created)
            await this.notifyNewBooking(result.form, result.booking);
        return result.booking;
    }
    async recordIntegrationFailure(booking, provider) {
        await this.events.save(this.events.create({
            organizationId: booking.organizationId,
            clientId: booking.clientId,
            reservationId: booking.id,
            type: 'integration_failed',
            actorType: 'system',
            metadata: { provider },
        }));
    }
    async enqueueGoogleConversion(booking, form, eventKey, conversionDate) {
        if (!this.googleOutbox)
            return;
        const capabilities = await this.clientCapabilities(form.organizationId, form.clientId);
        if (!capabilities.googleConversions)
            return;
        const config = await this.googleOutbox.resolveConfig(form.organizationId, form.clientId, eventKey);
        if (!config)
            return;
        const [firstName, ...lastNameParts] = (booking.guestName ?? '').trim().split(/\s+/);
        const location = (0, geo_inference_1.inferLocationFromPhone)(booking.guestPhone);
        await this.googleOutbox.enqueue(form.organizationId, config, `${eventKey}:${booking.id}`, {
            gclid: booking.gclid ?? undefined,
            gbraid: booking.gbraid ?? undefined,
            wbraid: booking.wbraid ?? undefined,
            orderId: booking.id,
            conversionDateTime: conversionDate,
            timezone: form.timezone,
            userData: {
                email: booking.guestEmail ?? undefined,
                phone: booking.guestPhone ?? undefined,
                firstName: firstName || undefined,
                lastName: lastNameParts.join(' ') || undefined,
                country: location.country,
                region: location.region,
                city: location.city,
            },
        });
    }
    async enqueueMetaConversion(booking, form, eventName, eventTime, eventSourceUrl) {
        const { pixelId, accessToken } = await this.getClientMetaConfig(form.clientId, form.organizationId);
        if (!pixelId || !accessToken)
            throw new Error('Meta pixel or CAPI token is not configured');
        const isWebEvent = eventName === 'Schedule';
        const actionSource = isWebEvent ? 'website' : 'physical_store';
        const fallbackUrl = process.env.APP_PUBLIC_URL ? `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/book/${encodeURIComponent(form.publicSlug)}` : undefined;
        eventSourceUrl = isWebEvent ? (eventSourceUrl || fallbackUrl || undefined) : undefined;
        const [firstName, ...lastNameParts] = (booking.guestName ?? '').trim().split(/\s+/);
        const lastName = lastNameParts.join(' ');
        const location = (0, geo_inference_1.inferLocationFromPhone)(booking.guestPhone);
        await this.metaOutbox.enqueue(form.organizationId, pixelId, {
            eventName, eventTime: eventTime ?? Math.floor(Date.now() / 1000), actionSource, eventSourceUrl,
            userData: {
                em: booking.guestEmail ? [booking.guestEmail] : undefined,
                ph: booking.guestPhone ? [booking.guestPhone] : undefined,
                fn: firstName ? [firstName] : undefined,
                ln: lastName ? [lastName] : undefined,
                externalId: [booking.id],
                ct: location.city ? [location.city] : undefined,
                st: location.region ? [location.region] : undefined,
                country: location.country ? [location.country] : undefined,
                fbc: booking.fbc ?? undefined,
                fbp: booking.fbp ?? undefined,
                client_ip_address: booking.clientIpAddress ?? undefined,
                client_user_agent: booking.clientUserAgent ?? undefined,
            },
            customData: { contentIds: [form.id], contentType: 'reservation' }, eventId: `${eventName.toLowerCase()}:${booking.id}`,
        });
    }
    async enqueueMetaSurveyConversion(response, form, dto, ipAddress, userAgent, eventSourceUrl) {
        const { pixelId, accessToken } = await this.getClientMetaConfig(form.clientId, form.organizationId);
        if (!pixelId || !accessToken)
            throw new Error('Meta pixel or CAPI token is not configured');
        const fallbackUrl = process.env.APP_PUBLIC_URL ? `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/book/${encodeURIComponent(form.publicSlug)}` : undefined;
        const [firstName, ...lastNameParts] = (dto.guestName ?? '').trim().split(/\s+/);
        const lastName = lastNameParts.join(' ');
        const phone = dto.guestPhone?.replace(/[^\d+]/g, '');
        const location = (0, geo_inference_1.inferLocationFromPhone)(phone);
        const rating = Number((dto.answers || {}).rating ?? (dto.answers || {}).experience_rating);
        await this.metaOutbox.enqueue(form.organizationId, pixelId, {
            eventName: 'Lead',
            eventTime: Math.floor(response.createdAt.getTime() / 1000),
            actionSource: 'website',
            eventSourceUrl: eventSourceUrl || fallbackUrl || undefined,
            userData: {
                em: dto.guestEmail ? [dto.guestEmail] : undefined,
                ph: phone ? [phone] : undefined,
                fn: firstName ? [firstName] : undefined,
                ln: lastName ? [lastName] : undefined,
                externalId: [response.id],
                ct: location.city ? [location.city] : undefined,
                st: location.region ? [location.region] : undefined,
                country: location.country ? [location.country] : undefined,
                fbc: dto.fbc ?? undefined,
                fbp: dto.fbp ?? undefined,
                client_ip_address: ipAddress ?? undefined,
                client_user_agent: userAgent ?? undefined,
            },
            customData: {
                contentIds: [form.id],
                contentType: 'survey',
                ...(Number.isFinite(rating) ? { value: rating } : {}),
            },
            eventId: `lead:${response.id}`,
        });
    }
    async notifyNewBooking(form, booking) {
        try {
            const rows = await this.dataSource.query(`SELECT DISTINCT id FROM users WHERE organization_id = ? AND is_active = 1 AND (client_id = ? OR id = (SELECT community_manager_id FROM clients WHERE id = ? AND organization_id = ?))`, [form.organizationId, form.clientId, form.clientId, form.organizationId]);
            const userIds = rows.map((row) => row.id).filter(Boolean);
            if (userIds.length === 0)
                return;
            await this.notifications.notifyMultiple(form.organizationId, userIds, 'reservation_created', 'Nueva reserva recibida', `${booking.guestName} reservó ${form.name} para el ${booking.startsAt.toLocaleString('es-CL')}.`, { reservationId: booking.id, formId: form.id, clientId: form.clientId, referenceCode: booking.referenceCode });
            const teamEmails = (form.teamNotifications || []).filter((email) => typeof email === 'string' && email.includes('@'));
            if (teamEmails.length > 0) {
                const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
                const html = `<h2>Nueva reserva recibida</h2><p><strong>${escapeHtml(booking.guestName)}</strong> reservó <strong>${escapeHtml(form.name)}</strong>.</p><p>Fecha: ${escapeHtml(booking.startsAt.toLocaleString('es-CL'))}<br>Personas: ${booking.partySize}<br>Código: ${escapeHtml(booking.referenceCode)}</p>`;
                void Promise.all(teamEmails.map((email) => this.emails.send(email, `Nueva reserva - ${form.name}`, html)))
                    .catch((err) => this.logger.warn(`Aviso por correo de la reserva ${booking.id} no enviado: ${err instanceof Error ? err.message : err}`));
            }
        }
        catch (err) {
            this.logger.warn(`Notification failed for booking ${booking.id}: ${err instanceof Error ? err.message : err}`);
        }
    }
    async listReservations(organizationId, query, clientId, clientIds, includeInternalNotes = true) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 50;
        const qb = this.reservations.createQueryBuilder('r').where('r.organization_id = :organizationId', { organizationId });
        if (clientId)
            qb.andWhere('r.client_id = :clientId', { clientId });
        else if (clientIds !== undefined)
            qb.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds });
        if (query.formId)
            qb.andWhere('r.form_id = :formId', { formId: query.formId });
        if (query.status)
            qb.andWhere('r.status = :status', { status: query.status });
        if (query.from)
            qb.andWhere('r.starts_at >= :from', { from: query.from });
        if (query.to)
            qb.andWhere('r.starts_at <= :to', { to: query.to });
        if (query.search)
            qb.andWhere('(r.guest_name LIKE :search OR r.guest_email LIKE :search OR r.guest_phone LIKE :search OR r.reference_code LIKE :search)', { search: `%${query.search}%` });
        if (query.couponCode)
            qb.andWhere('r.coupon_code = :couponCode', { couponCode: query.couponCode });
        const [items, total] = await qb.orderBy('r.starts_at', 'DESC').skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
        const safeItems = includeInternalNotes ? items : items.map(({ internalNotes: _internalNotes, ...item }) => item);
        const conversions = await this.metaConversionStatus(organizationId, items);
        const withConversion = safeItems.map((item) => ({ ...item, metaConversion: conversions.get(item.id) }));
        return { items: withConversion, total, page, pageSize, pages: Math.ceil(total / pageSize) };
    }
    async metaConversionStatus(organizationId, items) {
        const result = new Map();
        if (items.length === 0)
            return result;
        const eventIds = items.flatMap((item) => [`schedule:${item.id}`, `reserva_asistida:${item.id}`]);
        let rows = [];
        try {
            rows = await this.dataSource.query(`SELECT event_id, status FROM meta_conversion_outbox WHERE organization_id = ? AND event_id IN (${eventIds.map(() => '?').join(',')})`, [organizationId, ...eventIds]);
        }
        catch (err) {
            this.logger.warn(`No se pudo leer el estado de conversiones Meta: ${err instanceof Error ? err.message : err}`);
            return result;
        }
        const byEvent = new Map(rows.map((row) => [row.event_id, row.status]));
        for (const item of items) {
            const matchFields = [item.guestEmail, item.guestPhone, item.fbc, item.fbp, item.clientIpAddress].filter(Boolean).length;
            result.set(item.id, {
                schedule: byEvent.get(`schedule:${item.id}`) ?? null,
                attended: byEvent.get(`reserva_asistida:${item.id}`) ?? null,
                matchFields,
            });
        }
        return result;
    }
    async updateReservation(organizationId, id, dto, actorId, actorType, clientId, clientIds) {
        let formForMeta;
        let statusChangedTo;
        const saved = await this.transaction('actualizar reserva', async (manager) => {
            const repo = manager.getRepository(reservation_entity_1.Reservation);
            const qb = repo.createQueryBuilder('r').setLock('pessimistic_write').where('r.id = :id AND r.organization_id = :organizationId', { id, organizationId });
            if (clientId)
                qb.andWhere('r.client_id = :clientId', { clientId });
            else if (clientIds !== undefined)
                qb.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds });
            const item = await qb.getOne();
            if (!item)
                throw new common_1.NotFoundException('Reserva no encontrada');
            const previousStatus = item.status;
            const previousStart = item.startsAt;
            if (dto.startsAt) {
                if (!['pending', 'confirmed', 'rescheduled', 'waitlist'].includes(item.status))
                    throw new common_1.ConflictException(`No se puede reagendar una reserva en estado ${item.status}`);
                const form = await manager.getRepository(reservation_form_entity_1.ReservationForm).findOneByOrFail({ id: item.formId, organizationId });
                const startsAt = new Date(dto.startsAt);
                const available = await this.availability(manager, form, startsAt, item.partySize, item.serviceId, item.resourceId, item.id);
                item.startsAt = startsAt;
                item.endsAt = available.endsAt;
                item.status = 'rescheduled';
            }
            if (dto.status && dto.status !== item.status) {
                if (!STATUS_TRANSITIONS[item.status]?.includes(dto.status))
                    throw new common_1.ConflictException(`No se puede pasar de ${item.status} a ${dto.status}`);
                if (item.status === 'waitlist' && dto.status === 'confirmed') {
                    const form = await manager.getRepository(reservation_form_entity_1.ReservationForm).findOneByOrFail({ id: item.formId, organizationId });
                    await this.availability(manager, form, item.startsAt, item.partySize, item.serviceId, item.resourceId, item.id);
                }
                if (dto.status === 'attended') {
                    formForMeta = await manager.getRepository(reservation_form_entity_1.ReservationForm).findOneByOrFail({ id: item.formId, organizationId });
                }
                statusChangedTo = dto.status;
                item.status = dto.status;
            }
            if (dto.internalNotes !== undefined)
                item.internalNotes = dto.internalNotes;
            const result = await repo.save(item);
            const changedStart = previousStart.getTime() !== result.startsAt.getTime();
            if (previousStatus !== result.status || changedStart)
                await manager.save(reservation_event_entity_1.ReservationEvent, manager.create(reservation_event_entity_1.ReservationEvent, { organizationId, clientId: result.clientId, reservationId: result.id, type: changedStart ? 'rescheduled' : 'status_changed', fromStatus: previousStatus, toStatus: result.status, actorId, actorType, metadata: changedStart ? { from: previousStart.toISOString(), to: result.startsAt.toISOString() } : undefined }));
            return result;
        });
        const capabilities = formForMeta ? await this.clientCapabilities(organizationId, formForMeta.clientId) : undefined;
        if (statusChangedTo === 'attended' && formForMeta?.metaCapiEnabled && capabilities?.metaConversions) {
            try {
                await this.enqueueMetaConversion(saved, formForMeta, 'Reserva_Asistida', Math.floor(saved.startsAt.getTime() / 1000));
            }
            catch (err) {
                this.logger.warn(`Meta CAPI attended event failed for booking ${saved.id}: ${err instanceof Error ? err.message : err}`);
                await this.recordIntegrationFailure(saved, 'meta_capi');
            }
        }
        if (statusChangedTo === 'attended' && formForMeta) {
            try {
                await this.enqueueGoogleConversion(saved, formForMeta, 'attended', saved.startsAt);
            }
            catch (err) {
                this.logger.warn(`Google Ads attended event failed for booking ${saved.id}: ${err instanceof Error ? err.message : err}`);
                await this.recordIntegrationFailure(saved, 'google_ads');
            }
        }
        if (statusChangedTo === 'attended' || statusChangedTo === 'no_show') {
            try {
                await this.leadIntake.updateStatusByContact(organizationId, statusChangedTo === 'attended' ? 'attended' : 'no_show', saved.guestEmail, saved.guestPhone, saved.clientId);
            }
            catch (err) {
                this.logger.warn(`CRM status sync failed for booking ${saved.id}: ${err instanceof Error ? err.message : err}`);
            }
        }
        return saved;
    }
    async history(organizationId, reservationId, clientId, clientIds) { const reservation = await this.reservations.findOne({ where: { id: reservationId, ...this.scope(organizationId, clientId, clientIds) } }); if (!reservation)
        throw new common_1.NotFoundException('Reserva no encontrada'); return this.events.find({ where: { reservationId, organizationId }, order: { createdAt: 'DESC' } }); }
    async operationalHome(organizationId, clientId, clientIds) {
        const timezone = clientId ? await this.clientTimezone(clientId, organizationId) : 'America/Santiago';
        const today = this.localDateKey(new Date(), timezone);
        const from = (0, timezone_1.startOfLocalDayUtc)(today, timezone);
        const to = (0, timezone_1.startOfLocalDayUtc)((0, timezone_1.addPlainDays)(today, 1), timezone);
        const scope = this.sqlClientScope(clientId, clientIds);
        const [row] = await this.dataSource.query(`SELECT COUNT(*) total,
              SUM(status = 'attended') attended,
              SUM(status = 'pending') pending,
              SUM(status = 'no_show') noShow
       FROM reservations
       WHERE organization_id = ? AND starts_at >= ? AND starts_at < ? AND status NOT LIKE 'cancelled%'${scope.clause}`, [organizationId, from, to, ...scope.params]);
        const total = Number(row?.total ?? 0);
        const dailyCap = clientId ? await this.clientDailyCap(this.dataSource, clientId) : 0;
        const now = new Date();
        const horizon = new Date(now.getTime() + 3 * 3_600_000);
        const upcomingQuery = this.reservations.createQueryBuilder('r')
            .select(['r.id', 'r.guestName', 'r.partySize', 'r.startsAt', 'r.status', 'r.clientId'])
            .where('r.organization_id = :organizationId', { organizationId })
            .andWhere("r.status NOT LIKE 'cancelled%'")
            .andWhere('r.starts_at >= :now AND r.starts_at < :horizon', { now, horizon });
        if (clientId)
            upcomingQuery.andWhere('r.client_id = :clientId', { clientId });
        else if (clientIds !== undefined) {
            upcomingQuery.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds });
        }
        const upcoming = await upcomingQuery.orderBy('r.starts_at', 'ASC').take(12).getMany();
        const signal = await this.metaConversionStatus(organizationId, upcoming);
        return {
            date: today,
            timezone,
            today: {
                total,
                attended: Number(row?.attended ?? 0),
                pending: Number(row?.pending ?? 0),
                noShow: Number(row?.noShow ?? 0),
                dailyCap,
                occupancyPct: dailyCap > 0 ? Math.min(100, Math.round((total / dailyCap) * 100)) : null,
            },
            upcoming: upcoming.map((booking) => ({
                id: booking.id,
                startsAt: booking.startsAt.toISOString(),
                guestName: booking.guestName,
                partySize: booking.partySize,
                status: booking.status,
                metaConversion: signal.get(booking.id) ?? null,
            })),
        };
    }
    async metrics(organizationId, clientId, clientIds, days = '30') {
        const scoped = this.sqlClientScope(clientId, clientIds);
        const params = [organizationId, ...scoped.params];
        const scope = scoped.clause;
        const daysNum = Math.min(Math.max(Number(days) || 30, 1), 365);
        params.push(daysNum);
        const [totals, daily, sources, funnel, areas, byRubro] = await Promise.all([this.dataSource.query(`SELECT COUNT(*) total, SUM(status='pending') pending, SUM(status='confirmed') confirmed, SUM(status='attended') attended, SUM(status='no_show') no_show, SUM(status='waitlist') waitlist, SUM(status LIKE 'cancelled%') cancelled FROM reservations WHERE organization_id = ?${scope} AND starts_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`, params), this.dataSource.query(`SELECT DATE(starts_at) day, COUNT(*) total, SUM(status='attended') attended, SUM(status='no_show') no_show FROM reservations WHERE organization_id = ?${scope} AND starts_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY day ORDER BY day`, params), this.dataSource.query(`SELECT COALESCE(utm_source,'direct') source, COALESCE(utm_campaign,'Sin campaña') campaign, COUNT(*) total, SUM(status='attended') attended FROM reservations WHERE organization_id = ?${scope} AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY source,campaign ORDER BY total DESC LIMIT 20`, params), this.dataSource.query(`SELECT SUM(type='view') views, SUM(type='start') starts FROM reservation_form_events WHERE organization_id = ?${scope} AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`, params), this.dataSource.query(`SELECT COALESCE(NULLIF(resource_id,''),'Sin área') area, COUNT(*) total FROM reservations WHERE organization_id = ?${scope} AND starts_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY area ORDER BY total DESC LIMIT 10`, params), this.dataSource.query(`SELECT COALESCE(f.rubro, '') rubro, COUNT(*) total, SUM(r.status='attended') attended FROM reservations r LEFT JOIN reservation_forms f ON f.id = r.form_id WHERE r.organization_id = ?${scope} AND r.starts_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY f.rubro ORDER BY total DESC`, params)]);
        const total = Number(totals[0]?.total || 0);
        const views = Number(funnel[0]?.views || 0);
        return { totals: totals[0] || {}, daily, sources, areas, byRubro, funnel: { views, starts: Number(funnel[0]?.starts || 0), completed: total, conversionRate: views ? Math.round(total * 1000 / views) / 10 : null }, days: daysNum };
    }
    async occupancyCalendar(organizationId, month, clientId, clientIds) {
        if (!clientId)
            throw new common_1.BadRequestException('Selecciona un cliente para ver su ocupación');
        if (!/^\d{4}-\d{2}$/.test(month))
            throw new common_1.BadRequestException('Formato de mes inválido, usa YYYY-MM');
        if (clientIds !== undefined && !clientIds.includes(clientId))
            throw new common_1.ForbiddenException('No tienes acceso a este cliente');
        const capacity = await this.clientDailyCap(this.dataSource, clientId);
        const timezone = await this.clientTimezone(clientId, organizationId);
        const [year, monthNumber] = month.split('-').map(Number);
        const nextMonth = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}`;
        const from = (0, timezone_1.startOfLocalDayUtc)(`${month}-01`, timezone);
        const to = (0, timezone_1.startOfLocalDayUtc)(`${nextMonth}-01`, timezone);
        const reservations = await this.reservations.createQueryBuilder('r')
            .select(['r.startsAt'])
            .where('r.organization_id = :organizationId AND r.client_id = :clientId', { organizationId, clientId })
            .andWhere("r.status NOT LIKE 'cancelled%'")
            .andWhere('r.starts_at >= :from AND r.starts_at < :to', { from, to })
            .getMany();
        const countByDay = new Map();
        for (const reservation of reservations) {
            const key = this.localDateKey(reservation.startsAt, timezone);
            countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
        }
        const rows = [...countByDay.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, total]) => ({ day, total }));
        return {
            month, capacity,
            days: rows.map((row) => ({
                date: row.day, count: Number(row.total),
                pct: capacity > 0 ? Math.min(100, Math.round((Number(row.total) / capacity) * 100)) : null,
            })),
        };
    }
    async *streamCsv(organizationId, clientId, clientIds, from, to, limit) {
        const BATCH = 500;
        const baseQuery = () => {
            const qb = this.reservations.createQueryBuilder('r').where('r.organization_id = :organizationId', { organizationId });
            if (clientId)
                qb.andWhere('r.client_id = :clientId', { clientId });
            else if (clientIds !== undefined)
                qb.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds });
            if (from)
                qb.andWhere('r.starts_at >= :from', { from });
            if (to)
                qb.andWhere('r.starts_at <= :to', { to });
            return qb.orderBy('r.starts_at', 'DESC');
        };
        const answerKeys = new Set();
        for await (const rows of this.batches(() => baseQuery().select('r.answers', 'answers'), BATCH, limit, true)) {
            for (const row of rows) {
                const answers = typeof row.answers === 'string' ? JSON.parse(row.answers || '{}') : row.answers;
                if (answers && typeof answers === 'object')
                    Object.keys(answers).forEach((key) => answerKeys.add(key));
            }
        }
        const keys = [...answerKeys].sort();
        const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const toLine = (row) => row.map(escape).join(',');
        yield toLine(['codigo', 'nombre', 'correo', 'telefono', 'fecha', 'estado', 'origen', 'campana', 'cupon', 'personas', 'notas_internas', ...keys]);
        for await (const items of this.batches(baseQuery, BATCH, limit, false)) {
            const lines = items.map((item) => {
                const answers = (item.answers || {});
                return toLine([item.referenceCode, item.guestName, item.guestEmail, item.guestPhone, item.startsAt.toISOString(), item.status, item.utmSource, item.utmCampaign, item.couponCode, item.partySize, item.internalNotes, ...keys.map((key) => answers[key])]);
            });
            if (lines.length > 0)
                yield `\r\n${lines.join('\r\n')}`;
        }
    }
    async *batches(build, size, limit, raw) {
        let offset = 0;
        while (limit === undefined || offset < limit) {
            const take = limit === undefined ? size : Math.min(size, limit - offset);
            const qb = build().skip(offset).take(take);
            const rows = raw ? await qb.getRawMany() : await qb.getMany();
            if (rows.length === 0)
                return;
            yield rows;
            if (rows.length < take)
                return;
            offset += rows.length;
        }
    }
    async exportFormReservations(organizationId, formId, clientId, clientIds, format = 'csv', dateFrom, dateTo, fields = ['name', 'phone', 'email', 'date', 'status', 'attendance']) {
        const qb = this.reservations.createQueryBuilder('r').where('r.organization_id = :organizationId', { organizationId }).andWhere('r.form_id = :formId', { formId });
        if (clientId)
            qb.andWhere('r.client_id = :clientId', { clientId });
        else if (clientIds !== undefined)
            qb.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds });
        if (dateFrom)
            qb.andWhere('r.starts_at >= :dateFrom', { dateFrom });
        if (dateTo)
            qb.andWhere('r.starts_at <= :dateTo', { dateTo });
        const items = await qb.orderBy('r.starts_at', 'DESC').take(50000).getMany();
        const fieldMap = {
            name: (item) => item.guestName,
            phone: (item) => item.guestPhone ?? undefined,
            email: (item) => item.guestEmail ?? undefined,
            date: (item) => item.startsAt.toISOString(),
            status: (item) => item.status,
            attendance: (item) => item.status === 'attended' ? 'Sí' : item.status === 'no_show' ? 'No' : '-',
            notes: (item) => item.internalNotes ?? undefined,
            campaign: (item) => item.utmCampaign || '-',
            code: (item) => item.referenceCode,
            origin: (item) => item.utmSource || 'direct',
            coupon: (item) => item.couponCode || '-',
            party_size: (item) => item.partySize,
        };
        if (format === 'json') {
            return items.map((item) => {
                const record = {};
                for (const field of fields) {
                    record[field] = fieldMap[field]?.(item) ?? '-';
                }
                return record;
            });
        }
        else if (format === 'csv') {
            const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
            const headers = fields;
            return [headers, ...items.map((item) => fields.map((field) => fieldMap[field]?.(item) ?? '-'))].map((row) => row.map(escape).join(',')).join('\r\n');
        }
        throw new common_1.BadRequestException('Formato no soportado');
    }
    async createCoupon(organizationId, userId, dto, clientId) {
        const code = dto.code.trim().toUpperCase();
        if (!code)
            throw new common_1.BadRequestException('El código es obligatorio');
        const exists = await this.coupons.findOne({ where: { organizationId, code } });
        if (exists)
            throw new common_1.ConflictException('Ya existe un cupón con ese código');
        const validDays = dto.validDaysOfWeek ? [...new Set(dto.validDaysOfWeek)] : undefined;
        if (dto.validFromTime && dto.validUntilTime && this.minutes(dto.validFromTime) >= this.minutes(dto.validUntilTime)) {
            throw new common_1.BadRequestException('La hora de inicio del cupón debe ser anterior a la de término');
        }
        const validFrom = dto.validFrom ? new Date(dto.validFrom) : undefined;
        const validUntil = dto.validUntil ? new Date(dto.validUntil) : undefined;
        if (validFrom && validUntil && validUntil <= validFrom)
            throw new common_1.BadRequestException('La fecha de término debe ser posterior a la fecha de inicio');
        const coupon = this.coupons.create({ organizationId, clientId, code, discountType: dto.discountType || 'percentage', value: dto.value ?? 0, maxUses: dto.maxUses ?? 0, validFrom, validUntil, formIds: dto.formIds, validDaysOfWeek: validDays, validFromTime: dto.validFromTime, validUntilTime: dto.validUntilTime });
        return this.coupons.save(coupon);
    }
    async updateCoupon(organizationId, id, dto, clientIds) {
        const coupon = await this.coupons.findOne({ where: { id, organizationId } });
        if (!coupon)
            throw new common_1.NotFoundException('Cupón no encontrado');
        if (clientIds !== undefined && (!coupon.clientId || !clientIds.includes(coupon.clientId)))
            throw new common_1.ForbiddenException('No tienes acceso a este cupón');
        const update = {};
        for (const [key, value] of Object.entries(dto).filter(([, value]) => value !== undefined)) {
            if (key === 'validDaysOfWeek')
                update.validDaysOfWeek = Array.isArray(value) ? [...new Set(value)] : value;
            else if (key === 'validFrom' || key === 'validUntil')
                update[key] = new Date(value);
            else
                update[key] = value;
        }
        Object.assign(coupon, update);
        if (coupon.validFrom && coupon.validUntil && coupon.validUntil <= coupon.validFrom)
            throw new common_1.BadRequestException('La fecha de término debe ser posterior a la fecha de inicio');
        if (coupon.validFromTime && coupon.validUntilTime && this.minutes(coupon.validFromTime) >= this.minutes(coupon.validUntilTime))
            throw new common_1.BadRequestException('La hora de inicio del cupón debe ser anterior a la de término');
        return this.coupons.save(coupon);
    }
    listCoupons(organizationId, clientId, clientIds) {
        const qb = this.coupons.createQueryBuilder('coupon').where('coupon.organization_id = :organizationId', { organizationId });
        if (clientId)
            qb.andWhere('(coupon.client_id = :clientId OR coupon.client_id IS NULL)', { clientId });
        else if (clientIds?.length)
            qb.andWhere('(coupon.client_id IN (:...clientIds) OR coupon.client_id IS NULL)', { clientIds });
        else if (clientIds !== undefined)
            qb.andWhere('coupon.client_id IS NULL');
        return qb.orderBy('coupon.created_at', 'DESC').getMany();
    }
    async validatePublicCoupon(slug, code, startsAt) {
        const form = await this.publishedForm(slug);
        const coupon = await this.coupons.findOne({ where: { organizationId: form.organizationId, code: code.trim().toUpperCase(), active: true } });
        if (!coupon)
            throw new common_1.BadRequestException('Cupón no válido');
        if (coupon.clientId && coupon.clientId !== form.clientId)
            throw new common_1.BadRequestException('Cupón no válido');
        const now = new Date();
        if (coupon.validFrom && now < coupon.validFrom)
            throw new common_1.BadRequestException('El cupón aún no está activo');
        if (coupon.validUntil && now > coupon.validUntil)
            throw new common_1.BadRequestException('El cupón ha expirado');
        if (coupon.maxUses > 0 && coupon.usageCount >= coupon.maxUses)
            throw new common_1.BadRequestException('El cupón ya no tiene usos disponibles');
        if (coupon.formIds && coupon.formIds.length > 0 && !coupon.formIds.includes(form.id))
            throw new common_1.BadRequestException('El cupón no aplica para este formulario');
        if ((coupon.validDaysOfWeek?.length || coupon.validFromTime || coupon.validUntilTime) && !startsAt)
            throw new common_1.BadRequestException('Selecciona un horario para validar este cupón');
        if (startsAt)
            this.assertCouponSchedule(coupon, form, startsAt);
        return { valid: true, discountType: coupon.discountType, value: coupon.value };
    }
    async validateCoupon(code, form, manager, startsAt) {
        if (!code)
            return undefined;
        const coupon = await manager.getRepository(reservation_coupon_entity_1.ReservationCoupon).findOne({ where: { organizationId: form.organizationId, code: code.trim().toUpperCase(), active: true }, lock: { mode: 'pessimistic_write' } });
        if (!coupon)
            throw new common_1.BadRequestException('Cupón no válido');
        if (coupon.clientId && coupon.clientId !== form.clientId)
            throw new common_1.BadRequestException('Cupón no válido');
        const now = new Date();
        if (coupon.validFrom && now < coupon.validFrom)
            throw new common_1.BadRequestException('El cupón aún no está activo');
        if (coupon.validUntil && now > coupon.validUntil)
            throw new common_1.BadRequestException('El cupón ha expirado');
        if (coupon.maxUses > 0 && coupon.usageCount >= coupon.maxUses)
            throw new common_1.BadRequestException('El cupón ya no tiene usos disponibles');
        if (coupon.formIds && coupon.formIds.length > 0 && !coupon.formIds.includes(form.id))
            throw new common_1.BadRequestException('El cupón no aplica para este formulario');
        this.assertCouponSchedule(coupon, form, startsAt);
        return coupon;
    }
    assertCouponSchedule(coupon, form, startsAt) {
        const local = new Intl.DateTimeFormat('en-US', { timeZone: form.timezone, hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' })
            .formatToParts(startsAt)
            .reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {});
        const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(local.weekday);
        if (coupon.validDaysOfWeek && coupon.validDaysOfWeek.length > 0 && !coupon.validDaysOfWeek.includes(weekday)) {
            throw new common_1.BadRequestException('El cupón no es válido para el día de la reserva');
        }
        if (coupon.validFromTime || coupon.validUntilTime) {
            const minutes = Number(local.hour) * 60 + Number(local.minute);
            const from = coupon.validFromTime ? this.minutes(coupon.validFromTime) : 0;
            const until = coupon.validUntilTime ? this.minutes(coupon.validUntilTime) : 24 * 60;
            if (minutes < from || minutes >= until) {
                throw new common_1.BadRequestException(`El cupón solo aplica entre ${coupon.validFromTime ?? '00:00'} y ${coupon.validUntilTime ?? '23:59'}`);
            }
        }
    }
    defaultReservationCatalog() {
        return [
            {
                key: 'gastronomico', nombre: 'Gastronómico',
                tipos: [
                    { key: 'mesa', nombre: 'Reserva de mesa', cta: 'Reserva tu mesa', confirmacion: 'Tu mesa está confirmada. ¡Te esperamos!', duracionMin: 90, capacidad: 4, agenda: 'slot', campos: [{ id: 'name', tipo: 'text', label: 'Nombre', required: true, locked: true }, { id: 'phone', tipo: 'phone', label: 'Teléfono', required: true, locked: true }, { id: 'email', tipo: 'email', label: 'Correo', required: true, locked: true }, { id: 'guests', tipo: 'number', label: 'Comensales', required: true, locked: true }, { id: 'occasion', tipo: 'text', label: 'Ocasión (opcional)', required: false, locked: true }] },
                    { key: 'terraza', nombre: 'Terraza / exterior', cta: 'Reserva tu terraza', confirmacion: 'Tu espacio en terraza está confirmado.', duracionMin: 120, capacidad: 4, agenda: 'slot', campos: [{ id: 'name', tipo: 'text', label: 'Nombre', required: true, locked: true }, { id: 'phone', tipo: 'phone', label: 'Teléfono', required: true, locked: true }, { id: 'guests', tipo: 'number', label: 'Comensales', required: true, locked: true }] },
                    { key: 'pedido', nombre: 'Pedido / delivery', cta: 'Haz tu pedido', confirmacion: 'Recibimos tu pedido.', duracionMin: 15, capacidad: 1, agenda: 'none', campos: [{ id: 'name', tipo: 'text', label: 'Nombre', required: true, locked: true }, { id: 'phone', tipo: 'phone', label: 'Teléfono', required: true, locked: true }, { id: 'pickup', tipo: 'select', label: 'Tipo de retiro', required: true, locked: true }] },
                ],
            },
            {
                key: 'salud', nombre: 'Salud y Estética',
                tipos: [
                    { key: 'hora', nombre: 'Reserva de hora', cta: 'Reserva tu hora', confirmacion: 'Tu hora quedó agendada.', duracionMin: 45, capacidad: 1, agenda: 'slot', campos: [{ id: 'name', tipo: 'text', label: 'Nombre', required: true, locked: true }, { id: 'phone', tipo: 'phone', label: 'Teléfono', required: true, locked: true }, { id: 'email', tipo: 'email', label: 'Correo', required: true, locked: true }] },
                    { key: 'consulta', nombre: 'Consulta', cta: 'Agenda tu consulta', confirmacion: 'Tu consulta está agendada.', duracionMin: 30, capacidad: 1, agenda: 'slot', campos: [{ id: 'name', tipo: 'text', label: 'Nombre', required: true, locked: true }, { id: 'phone', tipo: 'phone', label: 'Teléfono', required: true, locked: true }, { id: 'reason', tipo: 'textarea', label: 'Motivo de consulta', required: false, locked: true }] },
                    { key: 'procedimiento', nombre: 'Procedimiento / tratamiento', cta: 'Agenda tu procedimiento', confirmacion: 'Tu procedimiento está agendado.', duracionMin: 60, capacidad: 1, agenda: 'slot', campos: [{ id: 'name', tipo: 'text', label: 'Nombre', required: true, locked: true }, { id: 'phone', tipo: 'phone', label: 'Teléfono', required: true, locked: true }, { id: 'consent', tipo: 'consent', label: 'Consentimiento informado', required: true, locked: true }] },
                ],
            },
            {
                key: 'legal', nombre: 'Legal',
                tipos: [
                    { key: 'consulta_inicial', nombre: 'Consulta inicial', cta: 'Agenda tu consulta', confirmacion: 'Tu consulta inicial está agendada.', duracionMin: 30, capacidad: 1, agenda: 'slot', campos: [{ id: 'name', tipo: 'text', label: 'Nombre', required: true, locked: true }, { id: 'email', tipo: 'email', label: 'Correo', required: true, locked: true }, { id: 'phone', tipo: 'phone', label: 'Teléfono', required: true, locked: true }, { id: 'area', tipo: 'select', label: 'Área legal', required: true, locked: true }] },
                    { key: 'revision', nombre: 'Revisión de contrato', cta: 'Agenda tu revisión', confirmacion: 'Tu revisión está agendada.', duracionMin: 45, capacidad: 1, agenda: 'slot', campos: [{ id: 'name', tipo: 'text', label: 'Nombre', required: true, locked: true }, { id: 'email', tipo: 'email', label: 'Correo', required: true, locked: true }, { id: 'detalle', tipo: 'textarea', label: 'Detalle del contrato', required: false, locked: true }] },
                ],
            },
            {
                key: 'inmobiliario', nombre: 'Inmobiliario',
                tipos: [
                    { key: 'visita', nombre: 'Visita a proyecto', cta: 'Agenda tu visita', confirmacion: 'Tu visita está agendada.', duracionMin: 60, capacidad: 1, agenda: 'slot', campos: [{ id: 'name', tipo: 'text', label: 'Nombre', required: true, locked: true }, { id: 'email', tipo: 'email', label: 'Correo', required: true, locked: true }, { id: 'phone', tipo: 'phone', label: 'Teléfono', required: true, locked: true }, { id: 'ticket', tipo: 'number', label: 'Presupuesto aprox.', required: false, locked: true }] },
                    { key: 'info', nombre: 'Solicitud de información', cta: 'Solicita información', confirmacion: 'Te enviamos la información.', duracionMin: 0, capacidad: 0, agenda: 'none', campos: [{ id: 'name', tipo: 'text', label: 'Nombre', required: true, locked: true }, { id: 'email', tipo: 'email', label: 'Correo', required: true, locked: true }, { id: 'proyecto', tipo: 'select', label: 'Proyecto de interés', required: true, locked: true }] },
                ],
            },
            {
                key: 'startups', nombre: 'Startups / Servicios',
                tipos: [
                    { key: 'demo', nombre: 'Demo', cta: 'Agenda una demo', confirmacion: 'Tu demo está agendada.', duracionMin: 30, capacidad: 1, agenda: 'slot', campos: [{ id: 'name', tipo: 'text', label: 'Nombre', required: true, locked: true }, { id: 'email', tipo: 'email', label: 'Correo', required: true, locked: true }] },
                    { key: 'info', nombre: 'Solicitud de información', cta: 'Solicita información', confirmacion: 'Te contactaremos.', duracionMin: 0, capacidad: 0, agenda: 'none', campos: [{ id: 'name', tipo: 'text', label: 'Nombre', required: true, locked: true }, { id: 'email', tipo: 'email', label: 'Correo', required: true, locked: true }, { id: 'mensaje', tipo: 'textarea', label: 'Cuéntanos tu caso', required: false, locked: true }] },
                ],
            },
        ];
    }
    async getReservationCatalog(organizationId) {
        const row = await this.reservationCatalog.findOne({ where: { organizationId } });
        if (row?.payload && Array.isArray(row.payload.rubros))
            return row.payload.rubros;
        return this.defaultReservationCatalog();
    }
    async saveReservationCatalog(organizationId, actorId, rubros) {
        if (!Array.isArray(rubros))
            throw new common_1.BadRequestException('El catálogo debe ser una lista de rubros');
        const row = await this.reservationCatalog.findOne({ where: { organizationId } });
        const payload = { rubros };
        if (row) {
            row.payload = payload;
            await this.reservationCatalog.save(row);
        }
        else {
            await this.reservationCatalog.save(this.reservationCatalog.create({ organizationId, payload }));
        }
        await this.audit.log({
            organizationId,
            actorId,
            entityType: 'ReservationCatalog',
            entityId: organizationId,
            action: 'updated',
            reason: 'Actualización de rubros y tipos de captación',
            after: { rubrosCount: rubros.length },
        });
        return rubros;
    }
    async resetReservationCatalog(organizationId, actorId) {
        const row = await this.reservationCatalog.findOne({ where: { organizationId } });
        if (row) {
            await this.reservationCatalog.remove(row);
            await this.audit.log({
                organizationId,
                actorId,
                entityType: 'ReservationCatalog',
                entityId: organizationId,
                action: 'deleted',
                reason: 'Restauración de rubros y tipos de captación al catálogo por defecto',
            });
        }
        return this.defaultReservationCatalog();
    }
};
exports.ReservationsService = ReservationsService;
exports.ReservationsService = ReservationsService = ReservationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(reservation_form_entity_1.ReservationForm)),
    __param(1, (0, typeorm_1.InjectRepository)(reservation_entity_1.Reservation)),
    __param(2, (0, typeorm_1.InjectRepository)(availability_block_entity_1.AvailabilityBlock)),
    __param(3, (0, typeorm_1.InjectRepository)(reservation_event_entity_1.ReservationEvent)),
    __param(4, (0, typeorm_1.InjectRepository)(reservation_form_event_entity_1.ReservationFormEvent)),
    __param(5, (0, typeorm_1.InjectRepository)(reservation_coupon_entity_1.ReservationCoupon)),
    __param(15, (0, typeorm_1.InjectRepository)(survey_contact_request_entity_1.SurveyContactRequest)),
    __param(16, (0, typeorm_1.InjectRepository)(reservation_catalog_entity_1.ReservationCatalog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        lead_intake_service_1.LeadIntakeService,
        google_calendar_service_1.GoogleCalendarService,
        meta_conversion_outbox_service_1.MetaConversionOutboxService,
        meta_client_pixel_service_1.MetaClientPixelService,
        notification_service_1.NotificationService,
        email_service_1.EmailService,
        audit_service_1.AuditService,
        google_conversion_outbox_service_1.GoogleConversionOutboxService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ReservationsService);
