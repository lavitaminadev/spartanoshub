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
exports.AGENCIA = exports.EmpresaInterceptor = exports.EMPRESA_RESUELTA = void 0;
exports.ambitoDeLaPeticion = ambitoDeLaPeticion;
const common_1 = require("@nestjs/common");
const account_access_service_1 = require("./account-access.service");
const empresa_resuelta_1 = require("./empresa-resuelta");
Object.defineProperty(exports, "AGENCIA", { enumerable: true, get: function () { return empresa_resuelta_1.AGENCIA; } });
exports.EMPRESA_RESUELTA = Symbol('empresaResuelta');
let EmpresaInterceptor = class EmpresaInterceptor {
    constructor(accesos) {
        this.accesos = accesos;
    }
    async intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const organizationId = request.organizationId ?? user?.organizationId;
        if (user?.id && organizationId) {
            const pedida = request.params?.clientId ?? request.query?.clientId ?? request.body?.clientId;
            try {
                request[exports.EMPRESA_RESUELTA] = await (0, empresa_resuelta_1.resolverEmpresa)(typeof pedida === 'string' ? pedida : undefined, user, {
                    alcanzables: await this.accesos.allowedClientIds(organizationId, user),
                    comprobar: (clientId) => this.accesos.assertClient(organizationId, user, clientId),
                });
            }
            catch (error) {
                request[exports.EMPRESA_RESUELTA] = error;
            }
        }
        return next.handle();
    }
};
exports.EmpresaInterceptor = EmpresaInterceptor;
exports.EmpresaInterceptor = EmpresaInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [account_access_service_1.AccountAccessService])
], EmpresaInterceptor);
function ambitoDeLaPeticion(request) {
    const guardado = request[exports.EMPRESA_RESUELTA];
    if (guardado instanceof Error)
        return guardado;
    return typeof guardado === 'string' ? guardado : undefined;
}
