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
var SolicitudesPorVencerJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolicitudesPorVencerJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../../../modules/users/user.entity");
const user_role_enum_1 = require("../../../modules/organizations/user-role.enum");
const service_requests_service_1 = require("../../../modules/service-requests/service-requests.service");
const email_service_1 = require("../../notifications/email.service");
const plantilla_de_correo_1 = require("../../notifications/plantilla-de-correo");
let SolicitudesPorVencerJob = SolicitudesPorVencerJob_1 = class SolicitudesPorVencerJob {
    constructor(users, solicitudes, email) {
        this.users = users;
        this.solicitudes = solicitudes;
        this.email = email;
        this.logger = new common_1.Logger(SolicitudesPorVencerJob_1.name);
    }
    async ejecutar(organizationId) {
        const { porVencer, vencidas } = await this.solicitudes.porVencer(organizationId);
        if (!porVencer.length && !vencidas.length) {
            this.logger.log('Ninguna solicitud de derechos en riesgo de plazo');
            return { porVencer: 0, vencidas: 0, avisados: 0 };
        }
        const destinatarios = await this.users.find({
            where: { organizationId, isActive: true, role: (0, typeorm_2.In)([user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.DEV]) },
            select: ['id', 'name', 'email'],
        });
        if (!destinatarios.length) {
            this.logger.error(`${vencidas.length} vencidas y ${porVencer.length} por vencer, y ninguna cuenta activa puede resolverlas`);
            return { porVencer: porVencer.length, vencidas: vencidas.length, avisados: 0 };
        }
        const dia = (fecha) => new Date(fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
        const linea = (fila) => `· ${fila.type} — ${fila.plazo ? `vence el ${dia(fila.plazo.vence)}` : 'sin plazo calculado'} (${fila.id.slice(0, 8)})`;
        const cuerpo = [
            vencidas.length ? `**${vencidas.length} solicitud(es) con el plazo vencido:**\n${vencidas.map(linea).join('\n')}` : '',
            porVencer.length ? `**${porVencer.length} por vencer:**\n${porVencer.map(linea).join('\n')}` : '',
            'Se atienden en Configuración → Solicitudes de derechos.',
        ].filter(Boolean).join('\n\n');
        let avisados = 0;
        for (const persona of destinatarios) {
            const { subject, html } = (0, plantilla_de_correo_1.componerCorreo)(vencidas.length
                ? `${vencidas.length} solicitud(es) de derechos con el plazo vencido`
                : `${porVencer.length} solicitud(es) de derechos por vencer`, cuerpo, { responsable: persona.name, fecha: new Date().toLocaleDateString('es-CL', { dateStyle: 'long' }) }, process.env.APP_PUBLIC_URL
                ? { texto: 'Ver las solicitudes', url: `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/settings` }
                : undefined);
            if (await this.email.send(persona.email, subject, html))
                avisados += 1;
        }
        this.logger.log(`Plazos de solicitudes: ${vencidas.length} vencidas, ${porVencer.length} por vencer, avisadas ${avisados} de ${destinatarios.length} personas`);
        return { porVencer: porVencer.length, vencidas: vencidas.length, avisados };
    }
    async handle() {
        const activos = await this.users.find({ where: { isActive: true }, select: { organizationId: true } });
        const organizaciones = [...new Set(activos.map((persona) => persona.organizationId).filter(Boolean))];
        for (const organizationId of organizaciones) {
            try {
                await this.ejecutar(organizationId);
            }
            catch (error) {
                this.logger.error(`No se pudo revisar los plazos de ${organizationId}: ${error instanceof Error ? error.message : error}`);
            }
        }
    }
};
exports.SolicitudesPorVencerJob = SolicitudesPorVencerJob;
exports.SolicitudesPorVencerJob = SolicitudesPorVencerJob = SolicitudesPorVencerJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        service_requests_service_1.ServiceRequestsService,
        email_service_1.EmailService])
], SolicitudesPorVencerJob);
