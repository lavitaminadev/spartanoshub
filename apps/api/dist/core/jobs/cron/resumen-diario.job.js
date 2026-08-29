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
var ResumenDiarioJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResumenDiarioJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const lead_entity_1 = require("../../../modules/crm/leads/lead.entity");
const approval_request_entity_1 = require("../../../modules/approvals/approval-request.entity");
const approval_request_status_enum_1 = require("../../../modules/approvals/approval-request-status.enum");
const user_entity_1 = require("../../../modules/users/user.entity");
const inactividad_del_lead_1 = require("../../../modules/crm/leads/inactividad-del-lead");
const email_service_1 = require("../../notifications/email.service");
const plantilla_de_correo_1 = require("../../notifications/plantilla-de-correo");
const parameter_resolver_service_1 = require("../../parameters/parameter-resolver.service");
const CERRADAS = ['won', 'lost', 'attended', 'no_show'];
let ResumenDiarioJob = ResumenDiarioJob_1 = class ResumenDiarioJob {
    constructor(leads, tareas, usuarios, correo, parametros) {
        this.leads = leads;
        this.tareas = tareas;
        this.usuarios = usuarios;
        this.correo = correo;
        this.parametros = parametros;
        this.logger = new common_1.Logger(ResumenDiarioJob_1.name);
    }
    async handle() {
        const ahora = new Date();
        const inicioDeHoy = new Date(ahora);
        inicioDeHoy.setHours(0, 0, 0, 0);
        const finDeHoy = new Date(ahora);
        finDeHoy.setHours(23, 59, 59, 999);
        const inicioDeAyer = new Date(inicioDeHoy.getTime() - 86_400_000);
        const activos = await this.usuarios.find({
            where: { isActive: true },
            select: { id: true, name: true, email: true, organizationId: true },
        });
        const encendidoPorOrganizacion = new Map();
        let enviados = 0;
        for (const persona of activos) {
            try {
                if (!persona.email)
                    continue;
                let encendido = encendidoPorOrganizacion.get(persona.organizationId);
                if (encendido === undefined) {
                    encendido = Boolean(await this.parametros.get('email.daily_digest_enabled', null, null, persona.organizationId));
                    encendidoPorOrganizacion.set(persona.organizationId, encendido);
                }
                if (!encendido)
                    continue;
                const cifras = await this.cifrasDe(persona, inicioDeHoy, finDeHoy, inicioDeAyer);
                if (cifras.pendientes === 0 && cifras.parados === 0 && cifras.nuevos === 0)
                    continue;
                await this.enviar(persona, cifras, ahora);
                enviados += 1;
            }
            catch (error) {
                this.logger.error(`No se pudo enviar el resumen a ${persona.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        this.logger.log(`Resúmenes diarios enviados: ${enviados} de ${activos.length} personas`);
    }
    async cifrasDe(persona, inicioDeHoy, finDeHoy, inicioDeAyer) {
        const pendientes = await this.tareas.count({
            where: {
                organizationId: persona.organizationId,
                kind: approval_request_status_enum_1.PendingKind.TASK,
                assignedTo: persona.id,
                status: (0, typeorm_2.Not)((0, typeorm_2.In)([approval_request_status_enum_1.ApprovalRequestStatus.APPROVED, approval_request_status_enum_1.ApprovalRequestStatus.REJECTED])),
                dueAt: (0, typeorm_2.Between)(inicioDeHoy, finDeHoy),
            },
        });
        const nuevos = await this.leads.count({
            where: {
                organizationId: persona.organizationId,
                assignedTo: persona.id,
                createdAt: (0, typeorm_2.Between)(inicioDeAyer, inicioDeHoy),
            },
        });
        const plazos = await this.plazosDe(persona.organizationId);
        const abiertos = await this.leads.find({
            where: {
                organizationId: persona.organizationId,
                assignedTo: persona.id,
                status: (0, typeorm_2.Not)((0, typeorm_2.In)(CERRADAS)),
            },
            select: { id: true, status: true, stageChangedAt: true, createdAt: true },
        });
        const parados = abiertos.filter((lead) => (0, inactividad_del_lead_1.inactividadDe)(lead, plazos).idleLevel !== null).length;
        return { pendientes, parados, nuevos };
    }
    async plazosDe(organizationId) {
        const ajustes = await this.parametros.getManyForOrganization([inactividad_del_lead_1.CLAVE_AVISO, inactividad_del_lead_1.CLAVE_ALERTA, inactividad_del_lead_1.CLAVE_ABANDONO], organizationId);
        return {
            notice: Number(ajustes.get(inactividad_del_lead_1.CLAVE_AVISO) ?? inactividad_del_lead_1.PLAZOS_POR_DEFECTO.notice),
            warning: Number(ajustes.get(inactividad_del_lead_1.CLAVE_ALERTA) ?? inactividad_del_lead_1.PLAZOS_POR_DEFECTO.warning),
            critical: Number(ajustes.get(inactividad_del_lead_1.CLAVE_ABANDONO) ?? inactividad_del_lead_1.PLAZOS_POR_DEFECTO.critical),
        };
    }
    async enviar(persona, cifras, hoy) {
        const [asunto, cuerpo] = await Promise.all([
            this.parametros.get('email.daily_digest_subject', null, null, persona.organizationId),
            this.parametros.get('email.daily_digest_body', null, null, persona.organizationId),
        ]);
        const { subject, html } = (0, plantilla_de_correo_1.componerCorreo)(String(asunto ?? 'Tu CRM hoy'), String(cuerpo ?? 'Tienes {{pendientes}} tareas y {{parados}} leads sin avanzar.'), {
            responsable: persona.name,
            fecha: hoy.toLocaleDateString('es-CL', { dateStyle: 'long' }),
            ...cifras,
        }, process.env.APP_PUBLIC_URL
            ? { texto: 'Abrir el CRM', url: `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/crm/tablero` }
            : undefined);
        await this.correo.send(persona.email, subject, html);
    }
};
exports.ResumenDiarioJob = ResumenDiarioJob;
exports.ResumenDiarioJob = ResumenDiarioJob = ResumenDiarioJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __param(1, (0, typeorm_1.InjectRepository)(approval_request_entity_1.ApprovalRequest)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        email_service_1.EmailService,
        parameter_resolver_service_1.ParameterResolver])
], ResumenDiarioJob);
