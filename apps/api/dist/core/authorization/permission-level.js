"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_LEVELS = void 0;
exports.satisfies = satisfies;
exports.isPermissionLevel = isPermissionLevel;
exports.recortarNivel = recortarNivel;
exports.PERMISSION_LEVELS = ['none', 'view', 'edit', 'manage'];
function satisfies(granted, required) {
    return exports.PERMISSION_LEVELS.indexOf(granted) >= exports.PERMISSION_LEVELS.indexOf(required);
}
function isPermissionLevel(value) {
    return exports.PERMISSION_LEVELS.includes(value);
}
function recortarNivel(granted, tope) {
    return exports.PERMISSION_LEVELS.indexOf(granted) > exports.PERMISSION_LEVELS.indexOf(tope) ? tope : granted;
}
