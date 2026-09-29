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
exports.RegistroDeCorreosController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const roles_decorator_1 = require("../authorization/roles.decorator");
const module_scope_decorator_1 = require("../authorization/module-scope.decorator");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const registro_de_correo_entity_1 = require("./registro-de-correo.entity");
let RegistroDeCorreosController = class RegistroDeCorreosController {
    constructor(registro) {
        this.registro = registro;
    }
    async listar(q, resultado) {
        const texto = q?.trim().slice(0, 120);
        const filtroResultado = ['enviado', 'rechazado', 'fallido', 'omitido'].includes(resultado ?? '') ? { resultado: resultado } : {};
        const where = texto
            ? [{ destinatario: (0, typeorm_2.Like)(`%${texto}%`), ...filtroResultado }, { asunto: (0, typeorm_2.Like)(`%${texto}%`), ...filtroResultado }]
            : filtroResultado;
        return this.registro.find({ where, order: { createdAt: 'DESC' }, take: 300 });
    }
};
exports.RegistroDeCorreosController = RegistroDeCorreosController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Últimos correos enviados, con su resultado' }),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('resultado')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RegistroDeCorreosController.prototype, "listar", null);
exports.RegistroDeCorreosController = RegistroDeCorreosController = __decorate([
    (0, swagger_1.ApiTags)('Registro de correos'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('registro-de-correos'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.DEV),
    (0, module_scope_decorator_1.ModuleScope)('settings'),
    __param(0, (0, typeorm_1.InjectRepository)(registro_de_correo_entity_1.RegistroDeCorreo)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], RegistroDeCorreosController);
