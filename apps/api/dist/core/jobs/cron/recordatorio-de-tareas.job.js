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
var RecordatorioDeTareasJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordatorioDeTareasJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const approval_request_entity_1 = require("../../../modules/approvals/approval-request.entity");
const approval_request_status_enum_1 = require("../../../modules/approvals/approval-request-status.enum");
const user_entity_1 = require("../../../modules/users/user.entity");
const lead_entity_1 = require("../../../modules/crm/leads/lead.entity");
const email_service_1 = require("../../notifications/email.service");
const plantilla_de_correo_1 = require("../../notifications/plantilla-de-correo");
const parameter_resolver_service_1 = require("../../parameters/parameter-resolver.service");
const UNA_HORA = 3_600_000;
const AVISOS = [
    { clave: '12h', horas: 12 },
    { clave: '3h', horas: 3 },
];
let RecordatorioDeTareasJob = RecordatorioDeTareasJob_1 = class RecordatorioDeTareasJob {
    constructor(tareas, usuarios, leads, correo, parametros) {
        this.tareas = tareas;
        this.usuarios = usuarios;
        this.leads = leads;
        this.correo = correo;
        this.parametros = parametros;
        this.logger = new common_1.Logger(RecordatorioDeTareasJob_1.name);
    }
    async handle() {
        const ahora = new Date();
        const candidatas = await this.tareas.find({
            where: {
                kind: approval_request_status_enum_1.PendingKind.TASK,
                status: (0, typeorm_2.Not)((0, typeorm_2.In)([approval_request_status_enum_1.ApprovalRequestStatus.APPROVED, approval_request_status_enum_1.ApprovalRequestStatus.REJECTED])),
                dueAt: (0, typeorm_2.Between)(ahora, new Date(ahora.getTime() + 12 * UNA_HORA)),
            },
            take: 500,
        });
        const encendidoPorOrganizacion = new Map();
        let enviados = 0;
        for (const tarea of candidatas) {
            try {
                if (!tarea.assignedTo || !tarea.dueAt)
                    continue;
                let encendido = encendidoPorOrganizacion.get(tarea.organizationId);
                if (encendido === undefined) {
                    encendido = Boolean(await this.parametros.get('email.task_reminder_enabled', null, null, tarea.organizationId));
                    encendidoPorOrganizacion.set(tarea.organizationId, encendido);
                }
                if (!encendido)
                    continue;
                const aviso = this.avisoQueToca(tarea, ahora);
                if (!aviso)
                    continue;
                const responsable = await this.usuarios.findOne({
                    where: { id: tarea.assignedTo },
                    select: { id: true, name: true, email: true },
                });
                if (!responsable?.email) {
                    this.logger.warn(`Tarea ${tarea.id}: su responsable no tiene correo`);
                    continue;
                }
                await this.enviar(tarea, aviso.horas, responsable.name, responsable.email);
                await this.tareas.update(tarea.id, { reminderSent: aviso.clave });
                enviados += 1;
            }
            catch (error) {
                this.logger.error(`No se pudo recordar la tarea ${tarea.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        this.logger.log(`Recordatorios de tarea enviados: ${enviados} de ${candidatas.length} revisadas`);
    }
    avisoQueToca(tarea, ahora) {
        const faltan = (tarea.dueAt.getTime() - ahora.getTime()) / UNA_HORA;
        const margen = (tarea.dueAt.getTime() - tarea.createdAt.getTime()) / UNA_HORA;
        for (const { clave, horas } of [...AVISOS].reverse()) {
            if (faltan > horas)
                continue;
            if (horas === 12 && margen <= 12)
                continue;
            if (tarea.reminderSent === clave || tarea.reminderSent === '3h')
                continue;
            return { clave, horas };
        }
        return null;
    }
    async enviar(tarea, horas, nombre, destino) {
        const [asunto, cuerpo] = await Promise.all([
            this.parametros.get('email.task_reminder_subject', null, null, tarea.organizationId),
            this.parametros.get('email.task_reminder_body', null, null, tarea.organizationId),
        ]);
        const lead = tarea.entityType === 'lead' && tarea.entityId
            ? await this.leads.findOne({ where: { id: tarea.entityId }, select: { id: true, name: true } })
            : null;
        const cuando = tarea.dueAt.toLocaleString('es-CL', {
            dateStyle: 'short', timeStyle: 'short',
        });
        const { subject, html } = (0, plantilla_de_correo_1.componerCorreo)(String(asunto ?? '{{tarea}} en {{horas}} horas'), String(cuerpo ?? 'Tienes «{{tarea}}» el {{cuando}}.'), { responsable: nombre, tarea: tarea.title, cuando, horas, lead: lead?.name ?? '' });
        await this.correo.send(destino, subject, html);
    }
};
exports.RecordatorioDeTareasJob = RecordatorioDeTareasJob;
exports.RecordatorioDeTareasJob = RecordatorioDeTareasJob = RecordatorioDeTareasJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(approval_request_entity_1.ApprovalRequest)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(2, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        email_service_1.EmailService,
        parameter_resolver_service_1.ParameterResolver])
], RecordatorioDeTareasJob);
