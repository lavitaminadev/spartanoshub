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
exports.LeadController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const create_lead_use_case_1 = require("./use-cases/create-lead.use-case");
const list_leads_use_case_1 = require("./use-cases/list-leads.use-case");
const convert_lead_use_case_1 = require("./use-cases/convert-lead.use-case");
const update_lead_use_case_1 = require("./use-cases/update-lead.use-case");
const get_lead_use_case_1 = require("./use-cases/get-lead.use-case");
const create_lead_dto_1 = require("./dto/create-lead.dto");
const update_lead_dto_1 = require("./dto/update-lead.dto");
const import_leads_dto_1 = require("./dto/import-leads.dto");
const import_leads_use_case_1 = require("./use-cases/import-leads.use-case");
const list_leads_dto_1 = require("./dto/list-leads.dto");
const reservation_entity_1 = require("../../reservations/domain/reservation.entity");
const lead_task_summary_service_1 = require("./lead-task-summary.service");
const lead_visibility_1 = require("./lead-visibility");
const client_capability_service_1 = require("../../../core/client-scope/client-capability.service");
const account_access_service_1 = require("../../../core/client-scope/account-access.service");
const module_scope_decorator_1 = require("../../../core/authorization/module-scope.decorator");
const process_history_service_1 = require("../../../core/process-history/process-history.service");
const process_stage_change_entity_1 = require("../../../core/process-history/process-stage-change.entity");
const user_role_enum_1 = require("../../organizations/user-role.enum");
let LeadController = class LeadController {
    constructor(createLead, listLeads, getLead, convertLead, updateLead, importLeads, reservationRepository, accountAccess, history, leadTasks, capacidades) {
        this.createLead = createLead;
        this.listLeads = listLeads;
        this.getLead = getLead;
        this.convertLead = convertLead;
        this.updateLead = updateLead;
        this.importLeads = importLeads;
        this.reservationRepository = reservationRepository;
        this.accountAccess = accountAccess;
        this.history = history;
        this.leadTasks = leadTasks;
        this.capacidades = capacidades;
    }
    async create(dto, req) {
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
        await this.capacidades.assert(req.organizationId, dto.clientId, 'crm');
        return this.createLead.execute({ ...dto, organizationId: req.organizationId });
    }
    async import(dto, req) {
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
        await this.capacidades.assert(req.organizationId, dto.clientId, 'crm');
        return this.importLeads.execute(req.organizationId, dto);
    }
    async list(query, req) {
        await this.assertPortalCrm(req);
        const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        if (query.clientId) {
            await this.capacidades.assert(req.organizationId, query.clientId, 'crm');
        }
        const acotarPorCapacidad = query.domain === 'audience' && !query.clientId;
        const conCrm = acotarPorCapacidad
            ? await this.capacidades.filtrar(req.organizationId, allowedClientIds, 'crm')
            : allowedClientIds;
        const pagina = await this.listLeads.execute(req.organizationId, query.limit, query.offset, {
            status: query.status,
            fitStatus: query.fitStatus,
            source: query.source,
            domain: query.domain,
            clientId: query.clientId,
            allowedClientIds: conCrm,
            onlyAssignedTo: (0, lead_visibility_1.veSoloLoSuyo)(req.user.role, req.user.crmProfile) ? req.user.id : undefined,
        });
        const tareas = await this.leadTasks.porLead(req.organizationId, pagina.data.map((lead) => lead.id));
        return {
            ...pagina,
            data: pagina.data.map((lead) => ({
                ...lead,
                openTasks: tareas.get(lead.id)?.openTasks ?? 0,
                nextStep: tareas.get(lead.id)?.nextStep ?? null,
            })),
        };
    }
    async getById(id, req) {
        await this.assertPortalCrm(req);
        const lead = await this.getLead.execute(id, req.organizationId);
        await this.assertLeadAccess(req, lead);
        return lead;
    }
    async historial(id, req) {
        await this.assertPortalCrm(req);
        await this.assertLeadAccess(req, await this.getLead.execute(id, req.organizationId));
        return this.history.timeline(process_stage_change_entity_1.ProcessSubject.LEAD, id);
    }
    async update(id, dto, req) {
        await this.assertPortalCrm(req);
        await this.assertLeadAccess(req, await this.getLead.execute(id, req.organizationId));
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId ?? undefined);
        await this.capacidades.assert(req.organizationId, dto.clientId ?? undefined, 'crm');
        return this.updateLead.execute(id, dto, req.organizationId, req.user.id);
    }
    async assertLeadAccess(req, lead) {
        if (!lead)
            throw new common_1.NotFoundException('Lead no encontrado');
        if ((0, lead_visibility_1.veSoloLoSuyo)(req.user.role, req.user.crmProfile) && lead.assignedTo && lead.assignedTo !== req.user.id) {
            throw new common_1.NotFoundException('Lead no encontrado');
        }
        const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        if (allowedClientIds === undefined)
            return lead;
        if (!lead.clientId || !allowedClientIds.includes(lead.clientId)) {
            throw new common_1.NotFoundException('Lead no encontrado');
        }
        return lead;
    }
    async assertPortalCrm(req) {
        if (req.user.role !== user_role_enum_1.UserRole.CLIENT)
            return;
        if (!req.user.clientId)
            throw new common_1.ForbiddenException('La cuenta cliente no está asociada a una empresa');
        await this.capacidades.assert(req.organizationId, req.user.clientId, 'crm');
    }
    async reservations(id, req) {
        await this.assertPortalCrm(req);
        const lead = await this.assertLeadAccess(req, await this.getLead.execute(id, req.organizationId));
        const conditions = [];
        const params = { organizationId: req.organizationId };
        if (lead.email) {
            conditions.push('r.guest_email = :email');
            params.email = lead.email;
        }
        if (lead.phone) {
            conditions.push('r.guest_phone = :phone');
            params.phone = lead.phone;
        }
        if (conditions.length === 0)
            return [];
        const query = this.reservationRepository.createQueryBuilder('r')
            .where('r.organization_id = :organizationId', params)
            .andWhere(`(${conditions.join(' OR ')})`);
        if (lead.clientId)
            query.andWhere('r.client_id = :clientId', { clientId: lead.clientId });
        return query
            .orderBy('r.starts_at', 'DESC')
            .take(50)
            .getMany();
    }
    convert(id, req) {
        return this.convertLead.execute(id, req.organizationId);
    }
};
exports.LeadController = LeadController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Crear un nuevo lead' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_lead_dto_1.CreateLeadDto, Object]),
    __metadata("design:returntype", Promise)
], LeadController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, swagger_1.ApiOperation)({ summary: 'Importar prospectos desde un archivo' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [import_leads_dto_1.ImportLeadsDto, Object]),
    __metadata("design:returntype", Promise)
], LeadController.prototype, "import", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar leads' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_leads_dto_1.ListLeadsQueryDto, Object]),
    __metadata("design:returntype", Promise)
], LeadController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener un lead' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LeadController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)(':id/historial'),
    (0, swagger_1.ApiOperation)({ summary: 'Historial de etapas de un lead' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LeadController.prototype, "historial", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar estado de un lead' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_lead_dto_1.UpdateLeadDto, Object]),
    __metadata("design:returntype", Promise)
], LeadController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(':id/reservations'),
    (0, swagger_1.ApiOperation)({ summary: 'Historial de reservas de un lead' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LeadController.prototype, "reservations", null);
__decorate([
    (0, common_1.Post)(':id/convert'),
    (0, swagger_1.ApiOperation)({ summary: 'Convertir lead a cliente' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LeadController.prototype, "convert", null);
exports.LeadController = LeadController = __decorate([
    (0, swagger_1.ApiTags)('CRM - Leads'),
    (0, common_1.Controller)('crm/leads'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('crm'),
    __param(6, (0, typeorm_1.InjectRepository)(reservation_entity_1.Reservation)),
    __metadata("design:paramtypes", [create_lead_use_case_1.CreateLeadUseCase,
        list_leads_use_case_1.ListLeadsUseCase,
        get_lead_use_case_1.GetLeadUseCase,
        convert_lead_use_case_1.ConvertLeadUseCase,
        update_lead_use_case_1.UpdateLeadUseCase,
        import_leads_use_case_1.ImportLeadsUseCase,
        typeorm_2.Repository,
        account_access_service_1.AccountAccessService,
        process_history_service_1.ProcessHistoryService,
        lead_task_summary_service_1.LeadTaskSummaryService,
        client_capability_service_1.ClientCapabilityService])
], LeadController);
