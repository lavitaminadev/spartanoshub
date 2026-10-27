"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENCIA = void 0;
exports.resolverEmpresa = resolverEmpresa;
exports.esUnaEmpresa = esUnaEmpresa;
const common_1 = require("@nestjs/common");
exports.AGENCIA = 'AGENCIA';
async function resolverEmpresa(pedida, user, alcance) {
    const declarada = (pedida ?? '').trim();
    if (declarada) {
        await alcance.comprobar(declarada);
        return declarada;
    }
    if (alcance.alcanzables === undefined)
        return exports.AGENCIA;
    const suyas = [...new Set([...(user.clientId ? [user.clientId] : []), ...alcance.alcanzables])];
    if (suyas.length === 1)
        return suyas[0];
    if (suyas.length === 0) {
        throw new common_1.BadRequestException('Tu cuenta no tiene ninguna empresa asignada');
    }
    throw new common_1.BadRequestException('Elige la empresa sobre la que trabajas');
}
function esUnaEmpresa(ambito) {
    return ambito !== exports.AGENCIA;
}
