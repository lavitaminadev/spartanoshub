"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.efectoEnElDisponible = efectoEnElDisponible;
const ud_movement_type_enum_1 = require("./ud-movement-type.enum");
function efectoEnElDisponible(tipo, monto) {
    const magnitud = Math.abs(Number(monto));
    switch (tipo) {
        case ud_movement_type_enum_1.UDMovementType.RESERVATION:
        case ud_movement_type_enum_1.UDMovementType.CONSUMPTION:
            return -magnitud;
        case ud_movement_type_enum_1.UDMovementType.RELEASE:
        case ud_movement_type_enum_1.UDMovementType.EXTRA:
        case ud_movement_type_enum_1.UDMovementType.BUDGET_ASSIGNED:
        case ud_movement_type_enum_1.UDMovementType.ROLLOVER:
            return magnitud;
        case ud_movement_type_enum_1.UDMovementType.ADJUSTMENT:
            return Number(monto);
        default:
            return 0;
    }
}
