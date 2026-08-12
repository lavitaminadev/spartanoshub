"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsModule = void 0;
const common_1 = require("@nestjs/common");
const reports_controller_1 = require("./reports.controller");
const vitamina_pulse_service_1 = require("./vitamina-pulse.service");
const typeorm_1 = require("@nestjs/typeorm");
const monthly_report_entity_1 = require("./monthly-report.entity");
const client_entity_1 = require("../clients/client.entity");
const monthly_reports_service_1 = require("./monthly-reports.service");
let ReportsModule = class ReportsModule {
};
exports.ReportsModule = ReportsModule;
exports.ReportsModule = ReportsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([monthly_report_entity_1.MonthlyReport, client_entity_1.Client])],
        controllers: [reports_controller_1.ReportingController],
        providers: [vitamina_pulse_service_1.VitaminaPulseService, monthly_reports_service_1.MonthlyReportsService],
    })
], ReportsModule);
