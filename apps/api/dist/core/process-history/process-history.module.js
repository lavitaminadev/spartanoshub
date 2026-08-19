"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessHistoryModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const process_history_service_1 = require("./process-history.service");
const process_stage_change_entity_1 = require("./process-stage-change.entity");
let ProcessHistoryModule = class ProcessHistoryModule {
};
exports.ProcessHistoryModule = ProcessHistoryModule;
exports.ProcessHistoryModule = ProcessHistoryModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([process_stage_change_entity_1.ProcessStageChange])],
        providers: [process_history_service_1.ProcessHistoryService],
        exports: [process_history_service_1.ProcessHistoryService],
    })
], ProcessHistoryModule);
