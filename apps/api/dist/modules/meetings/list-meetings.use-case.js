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
exports.ListMeetingsUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const meeting_entity_1 = require("./meeting.entity");
let ListMeetingsUseCase = class ListMeetingsUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(organizationId, type, clientId, clientIds) {
        const where = { organizationId };
        if (type)
            where.type = type;
        if (clientId)
            where.clientId = clientId;
        if (clientIds !== undefined)
            where.clientId = (0, typeorm_2.In)(clientIds);
        return this.repo.find({ where, order: { scheduledAt: 'DESC' }, take: 300 });
    }
};
exports.ListMeetingsUseCase = ListMeetingsUseCase;
exports.ListMeetingsUseCase = ListMeetingsUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(meeting_entity_1.Meeting)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ListMeetingsUseCase);
//# sourceMappingURL=list-meetings.use-case.js.map