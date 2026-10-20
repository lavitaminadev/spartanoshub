"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exigirConstanciaDeRevelacion = exigirConstanciaDeRevelacion;
const common_1 = require("@nestjs/common");
async function exigirConstanciaDeRevelacion(audit, nivel, constancia) {
    if (nivel === 'oculto')
        throw new common_1.ForbiddenException('Tu perfil no permite ver estos datos');
    if (nivel !== 'bajo_registro')
        return;
    await audit.log({
        organizationId: constancia.organizationId,
        actorId: constancia.actorId,
        entityType: constancia.entityType,
        entityId: constancia.entityId,
        action: 'reveal_protected_data',
        reason: `campos=${constancia.campos.join(',')}`,
        ipAddress: constancia.ipAddress,
    });
}
