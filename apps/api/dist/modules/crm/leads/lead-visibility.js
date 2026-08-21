"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.veSoloLoSuyo = veSoloLoSuyo;
const user_role_enum_1 = require("../../organizations/user-role.enum");
const VEN_TODO = new Set([
    user_role_enum_1.UserRole.DEV,
    user_role_enum_1.UserRole.ADMIN,
    user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR,
    user_role_enum_1.UserRole.OPERATIONS_DIRECTOR,
    user_role_enum_1.UserRole.CREATIVE_DIRECTOR,
    user_role_enum_1.UserRole.ART_DIRECTOR,
    user_role_enum_1.UserRole.AV_DIRECTOR,
    user_role_enum_1.UserRole.CLIENT,
]);
function veSoloLoSuyo(role) {
    return !VEN_TODO.has(role);
}
