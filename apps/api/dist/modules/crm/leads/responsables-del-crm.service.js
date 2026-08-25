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
exports.ResponsablesDelCrmService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../../users/user.entity");
let ResponsablesDelCrmService = class ResponsablesDelCrmService {
    constructor(usuarios) {
        this.usuarios = usuarios;
    }
    async execute(organizationId, clientId) {
        const usuarios = await this.usuarios.find({
            where: {
                organizationId,
                isActive: true,
                clientId: clientId ? clientId : (0, typeorm_2.IsNull)(),
            },
            order: { name: 'ASC' },
            select: { id: true, name: true },
        });
        return usuarios.map((usuario) => ({ id: usuario.id, name: usuario.name }));
    }
};
exports.ResponsablesDelCrmService = ResponsablesDelCrmService;
exports.ResponsablesDelCrmService = ResponsablesDelCrmService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ResponsablesDelCrmService);
