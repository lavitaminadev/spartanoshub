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
exports.CronRun = void 0;
const typeorm_1 = require("typeorm");
let CronRun = class CronRun {
};
exports.CronRun = CronRun;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 80 }),
    __metadata("design:type", String)
], CronRun.prototype, "task", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_run_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], CronRun.prototype, "lastRunAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], CronRun.prototype, "ok", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], CronRun.prototype, "detail", void 0);
exports.CronRun = CronRun = __decorate([
    (0, typeorm_1.Entity)('cron_runs')
], CronRun);
