"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CANCEL_ORIGIN_LABELS = exports.CancelOrigin = void 0;
var CancelOrigin;
(function (CancelOrigin) {
    CancelOrigin["CLIENT"] = "client";
    CancelOrigin["PRODUCTION"] = "production";
    CancelOrigin["COMMERCIAL"] = "commercial";
})(CancelOrigin || (exports.CancelOrigin = CancelOrigin = {}));
exports.CANCEL_ORIGIN_LABELS = {
    [CancelOrigin.CLIENT]: 'Lo pidió el cliente',
    [CancelOrigin.PRODUCTION]: 'Error de la agencia',
    [CancelOrigin.COMMERCIAL]: 'Decisión comercial o de planificación',
};
