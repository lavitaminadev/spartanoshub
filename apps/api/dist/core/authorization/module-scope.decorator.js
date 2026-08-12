"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleExempt = exports.ModuleScope = exports.MODULE_EXEMPT_KEY = exports.MODULE_SCOPE_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.MODULE_SCOPE_KEY = 'moduleScope';
exports.MODULE_EXEMPT_KEY = 'moduleExempt';
const ModuleScope = (module) => (0, common_1.SetMetadata)(exports.MODULE_SCOPE_KEY, module);
exports.ModuleScope = ModuleScope;
const ModuleExempt = (reason) => (0, common_1.SetMetadata)(exports.MODULE_EXEMPT_KEY, reason);
exports.ModuleExempt = ModuleExempt;
//# sourceMappingURL=module-scope.decorator.js.map