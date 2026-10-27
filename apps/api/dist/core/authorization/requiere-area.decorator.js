"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequiereArea = exports.REQUIERE_AREA_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REQUIERE_AREA_KEY = 'requiereArea';
const RequiereArea = (clave, nivel = 'hacer') => (0, common_1.SetMetadata)(exports.REQUIERE_AREA_KEY, { clave, nivel });
exports.RequiereArea = RequiereArea;
