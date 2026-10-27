"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Empresa = exports.SinEmpresa = exports.SIN_EMPRESA_KEY = void 0;
const common_1 = require("@nestjs/common");
const empresa_resuelta_1 = require("./empresa-resuelta");
const empresa_interceptor_1 = require("./empresa.interceptor");
exports.SIN_EMPRESA_KEY = 'sinEmpresa';
const SinEmpresa = (motivo) => (0, common_1.SetMetadata)(exports.SIN_EMPRESA_KEY, motivo);
exports.SinEmpresa = SinEmpresa;
exports.Empresa = (0, common_1.createParamDecorator)(({ oAgencia = false, oTodasLasQueAlcanza = false } = {}, ctx) => {
    const ambito = (0, empresa_interceptor_1.ambitoDeLaPeticion)(ctx.switchToHttp().getRequest());
    if (ambito instanceof Error) {
        if (oAgencia && oTodasLasQueAlcanza && ambito instanceof empresa_resuelta_1.VariasEmpresasAlcanzables)
            return empresa_resuelta_1.AGENCIA;
        throw ambito;
    }
    if (ambito === undefined) {
        throw new common_1.InternalServerErrorException('La empresa de la petición no se resolvió');
    }
    if (ambito === empresa_resuelta_1.AGENCIA && !oAgencia) {
        throw new common_1.InternalServerErrorException('Esta ruta necesita una empresa; usa @Empresa({ oAgencia: true }) si abarca la agencia');
    }
    return ambito;
});
