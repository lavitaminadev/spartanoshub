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
    constructor(leads, notificaciones, parametros) {
        this.leads = leads;
        this.notificaciones = notificaciones;
        this.parametros = parametros;
        this.logger = new common_1.Logger(LeadsParadosJob_1.name);
    }
    async handle() {
        const candidatos = await this.leads.find({
            where: {
                status: (0, typeorm_2.Not)((0, typeorm_2.In)(['won', 'lost', 'attended', 'no_show'])),
                assignedTo: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()),
            },
            select: {
                id: true, organizationId: true, name: true, status: true,
                assignedTo: true, stageChangedAt: true, createdAt: true, idleAlertedLevel: true,
            },
        });
        const plazosPorOrganizacion = new Map();
        let avisados = 0;
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
                const { titulo, verbo } = MENSAJE[idleLevel];
                await this.notificaciones.save(this.notificaciones.create({
                    userId: lead.assignedTo,
                    organizationId: lead.organizationId,
                    type: 'lead.idle',
                    title: titulo,
                    message: `«${lead.name}» ${verbo} ${idleDays} ${idleDays === 1 ? 'día' : 'días'} sin avanzar.`,
                    data: { leadId: lead.id, status: lead.status, idleDays, idleLevel },
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
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        parameter_resolver_service_1.ParameterResolver])
], LeadsParadosJob);
