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
var ImportLeadsUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportLeadsUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const lead_intake_service_1 = require("../lead-intake.service");
const lead_entity_1 = require("../lead.entity");
const phone_1 = require("../../../../shared/phone");
let ImportLeadsUseCase = ImportLeadsUseCase_1 = class ImportLeadsUseCase {
    constructor(intake, leads) {
        this.intake = intake;
        this.leads = leads;
        this.logger = new common_1.Logger(ImportLeadsUseCase_1.name);
    }
    async execute(organizationId, dto) {
        const result = { imported: 0, duplicates: 0, failed: [] };
        for (const [index, row] of dto.rows.entries()) {
            const rowNumber = index + 2;
            if (!row.email && !row.phone) {
                result.failed.push({ row: rowNumber, name: row.name, reason: 'Sin correo ni teléfono: no hay forma de reconocer a la persona' });
                continue;
            }
            try {
                const yaExistia = await this.findExisting(organizationId, row.email, row.phone);
                await this.intake.captureLead({
                    organizationId,
                    domain: 'commercial',
                    name: row.name,
                    email: row.email,
                    phone: row.phone,
                    company: row.company,
                    notes: row.notes,
                    source: dto.source,
                    sourceDetail: dto.sourceDetail,
                }, 'upsert');
                if (yaExistia)
                    result.duplicates += 1;
                else
                    result.imported += 1;
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : 'Error desconocido';
                result.failed.push({ row: rowNumber, name: row.name, reason });
                this.logger.warn(`Fila ${rowNumber} de la importación no se pudo guardar: ${reason}`);
            }
        }
        return result;
    }
    async findExisting(organizationId, email, phone) {
        const where = [];
        const normalizedEmail = email?.trim().toLowerCase();
        const normalizedPhone = (0, phone_1.normalizePhone)(phone);
        if (normalizedEmail)
            where.push({ organizationId, email: normalizedEmail });
        if (normalizedPhone)
            where.push({ organizationId, phone: normalizedPhone });
        if (!where.length)
            return false;
        return (await this.leads.count({ where })) > 0;
    }
};
exports.ImportLeadsUseCase = ImportLeadsUseCase;
exports.ImportLeadsUseCase = ImportLeadsUseCase = ImportLeadsUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __metadata("design:paramtypes", [lead_intake_service_1.LeadIntakeService,
        typeorm_2.Repository])
], ImportLeadsUseCase);
