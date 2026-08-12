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
exports.CreateLeadUseCase = void 0;
const common_1 = require("@nestjs/common");
const lead_intake_service_1 = require("../lead-intake.service");
let CreateLeadUseCase = class CreateLeadUseCase {
    constructor(leadIntake) {
        this.leadIntake = leadIntake;
    }
    async execute(data) {
        return this.leadIntake.captureLead(data);
    }
};
exports.CreateLeadUseCase = CreateLeadUseCase;
exports.CreateLeadUseCase = CreateLeadUseCase = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [lead_intake_service_1.LeadIntakeService])
], CreateLeadUseCase);
//# sourceMappingURL=create-lead.use-case.js.map