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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonthlyReport = void 0;
const typeorm_1 = require("typeorm");
let MonthlyReport = class MonthlyReport {
};
exports.MonthlyReport = MonthlyReport;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MonthlyReport.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], MonthlyReport.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], MonthlyReport.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'smallint' }),
    __metadata("design:type", Number)
], MonthlyReport.prototype, "year", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint' }),
    __metadata("design:type", Number)
], MonthlyReport.prototype, "month", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], MonthlyReport.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'draft' }),
    __metadata("design:type", String)
], MonthlyReport.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'executive_summary', type: 'text', nullable: true }),
    __metadata("design:type", String)
], MonthlyReport.prototype, "executiveSummary", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json' }),
    __metadata("design:type", Object)
], MonthlyReport.prototype, "metrics", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], MonthlyReport.prototype, "insights", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], MonthlyReport.prototype, "recommendations", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sales_generated', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MonthlyReport.prototype, "salesGenerated", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ad_spend', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MonthlyReport.prototype, "adSpend", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MonthlyReport.prototype, "leads", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MonthlyReport.prototype, "bookings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MonthlyReport.prototype, "conversions", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid' }),
    __metadata("design:type", String)
], MonthlyReport.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'published_by', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], MonthlyReport.prototype, "publishedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'published_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], MonthlyReport.prototype, "publishedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], MonthlyReport.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], MonthlyReport.prototype, "updatedAt", void 0);
exports.MonthlyReport = MonthlyReport = __decorate([
    (0, typeorm_1.Entity)('monthly_reports'),
    (0, typeorm_1.Index)('UQ_monthly_reports_client_period', ['clientId', 'year', 'month'], { unique: true })
], MonthlyReport);
//# sourceMappingURL=monthly-report.entity.js.map