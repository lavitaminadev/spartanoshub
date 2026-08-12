"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequiresPermission = exports.REQUIRES_PERMISSION_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REQUIRES_PERMISSION_KEY = 'requiresPermission';
const RequiresPermission = (module, level) => (0, common_1.SetMetadata)(exports.REQUIRES_PERMISSION_KEY, { module, level });
exports.RequiresPermission = RequiresPermission;
//# sourceMappingURL=requires-permission.decorator.js.map