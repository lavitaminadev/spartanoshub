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
var LeadCierreService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadCierreService = void 0;
const common_1 = require("@nestjs/common");
const notification_service_1 = require("../../../core/notifications/notification.service");
const lead_status_enum_1 = require("./lead-status.enum");
const CIERRES = {
    [lead_status_enum_1.LeadStatus.WON]: { titulo: 'Venta cerrada', bueno: true },
    [lead_status_enum_1.LeadStatus.ATTENDED]: { titulo: 'Asistió', bueno: true },
    [lead_status_enum_1.LeadStatus.LOST]: { titulo: 'Descartado', bueno: false },
    [lead_status_enum_1.LeadStatus.NO_SHOW]: { titulo: 'No asistió', bueno: false },
};
let LeadCierreService = LeadCierreService_1 = class LeadCierreService {
    constructor(notificaciones) {
        this.notificaciones = notificaciones;
        this.logger = new common_1.Logger(LeadCierreService_1.name);
    }
    async avisar(lead, anterior, actorId) {
        const cierre = CIERRES[lead.status];
        if (!cierre || anterior === lead.status)
            return;
        if (!lead.assignedTo || lead.assignedTo === actorId)
            return;
        const detalle = cierre.bueno
            ? `${lead.name} llegó al final del embudo.`
            : `${lead.name} salió del embudo${lead.discardReason ? `: ${lead.discardReason}` : '.'}`;
        try {
            await this.notificaciones.notifyUser(lead.organizationId, lead.assignedTo, 'crm.lead.cerrado', `${cierre.titulo} · ${lead.name}`, detalle, { leadId: lead.id, status: lead.status, clientId: lead.clientId ?? null });
        }
        catch (error) {
            this.logger.warn(`No se pudo avisar del cierre del lead ${lead.id}: ${error.message}`);
        }
    }
};
exports.LeadCierreService = LeadCierreService;
exports.LeadCierreService = LeadCierreService = LeadCierreService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [notification_service_1.NotificationService])
], LeadCierreService);
