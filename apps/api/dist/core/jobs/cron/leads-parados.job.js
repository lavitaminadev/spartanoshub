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
var LeadsParadosJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadsParadosJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../../../modules/users/user.entity");
const user_role_enum_1 = require("../../../modules/organizations/user-role.enum");
const lead_entity_1 = require("../../../modules/crm/leads/lead.entity");
const inactividad_del_lead_1 = require("../../../modules/crm/leads/inactividad-del-lead");
const notification_entity_1 = require("../../notifications/notification.entity");
const parameter_resolver_service_1 = require("../../parameters/parameter-resolver.service");
const ORDEN = ['notice', 'warning', 'critical'];
const MENSAJE = {
    notice: { titulo: 'Lead sin mover', verbo: 'lleva' },
    warning: { titulo: 'Lead enfriándose', verbo: 'lleva ya' },
    critical: { titulo: 'Lead abandonado', verbo: 'lleva' },
};
let LeadsParadosJob = LeadsParadosJob_1 = class LeadsParadosJob {
    constructor(leads, notificaciones, usuarios, parametros) {
        this.leads = leads;
        this.notificaciones = notificaciones;
        this.usuarios = usuarios;
        this.parametros = parametros;
        this.logger = new common_1.Logger(LeadsParadosJob_1.name);
        this.responsablePorOrganizacion = new Map();
    }
    async handle() {
        const candidatos = await this.leads.find({
            where: {
                status: (0, typeorm_2.Not)((0, typeorm_2.In)(['won', 'lost', 'attended', 'no_show'])),
            },
            select: {
                id: true, organizationId: true, name: true, status: true,
                assignedTo: true, stageChangedAt: true, createdAt: true, idleAlertedLevel: true,
            },
        });
        const plazosPorOrganizacion = new Map();
        let avisados = 0;
        this.responsablePorOrganizacion.clear();
        for (const lead of candidatos) {
            try {
                let plazos = plazosPorOrganizacion.get(lead.organizationId);
                if (!plazos) {
                    plazos = await this.plazosDe(lead.organizationId);
                    plazosPorOrganizacion.set(lead.organizationId, plazos);
                }
                const { idleDays, idleLevel } = (0, inactividad_del_lead_1.inactividadDe)(lead, plazos);
                if (!idleLevel)
                    continue;
                const yaAvisado = ORDEN.indexOf(lead.idleAlertedLevel);
                if (yaAvisado >= ORDEN.indexOf(idleLevel))
                    continue;
                const destinatario = lead.assignedTo ?? await this.quienDirigeElCrm(lead.organizationId);
                if (!destinatario)
                    continue;
                const { titulo, verbo } = MENSAJE[idleLevel];
                const sinDuenio = !lead.assignedTo;
                await this.notificaciones.save(this.notificaciones.create({
                    userId: destinatario,
                    organizationId: lead.organizationId,
                    type: 'lead.idle',
                    title: sinDuenio ? 'Prospecto sin responsable' : titulo,
                    message: sinDuenio
                        ? `«${lead.name}» lleva ${idleDays} ${idleDays === 1 ? 'día' : 'días'} sin que nadie lo tome.`
                        : `«${lead.name}» ${verbo} ${idleDays} ${idleDays === 1 ? 'día' : 'días'} sin avanzar.`,
                    data: { leadId: lead.id, status: lead.status, idleDays, idleLevel, sinResponsable: sinDuenio },
                }));
                await this.leads.update(lead.id, { idleAlertedLevel: idleLevel });
                avisados += 1;
            }
            catch (error) {
                this.logger.error(`No se pudo avisar del lead ${lead.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        this.logger.log(`Leads parados avisados: ${avisados} de ${candidatos.length} revisados`);
    }
    async quienDirigeElCrm(organizationId) {
        const recordado = this.responsablePorOrganizacion.get(organizationId);
        if (recordado !== undefined)
            return recordado ?? undefined;
        for (const role of [user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.ADMIN]) {
            const persona = await this.usuarios.findOne({
                where: { organizationId, role, isActive: true },
                order: { createdAt: 'ASC' },
                select: { id: true },
            });
            if (persona) {
                this.responsablePorOrganizacion.set(organizationId, persona.id);
                return persona.id;
            }
        }
        this.responsablePorOrganizacion.set(organizationId, null);
        return undefined;
    }
    async plazosDe(organizationId) {
        const ajustes = await this.parametros.getManyForOrganization([inactividad_del_lead_1.CLAVE_AVISO, inactividad_del_lead_1.CLAVE_ALERTA, inactividad_del_lead_1.CLAVE_ABANDONO], organizationId);
        return {
            notice: Number(ajustes.get(inactividad_del_lead_1.CLAVE_AVISO) ?? inactividad_del_lead_1.PLAZOS_POR_DEFECTO.notice),
            warning: Number(ajustes.get(inactividad_del_lead_1.CLAVE_ALERTA) ?? inactividad_del_lead_1.PLAZOS_POR_DEFECTO.warning),
            critical: Number(ajustes.get(inactividad_del_lead_1.CLAVE_ABANDONO) ?? inactividad_del_lead_1.PLAZOS_POR_DEFECTO.critical),
        };
    }
};
exports.LeadsParadosJob = LeadsParadosJob;
exports.LeadsParadosJob = LeadsParadosJob = LeadsParadosJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __param(1, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        parameter_resolver_service_1.ParameterResolver])
], LeadsParadosJob);
