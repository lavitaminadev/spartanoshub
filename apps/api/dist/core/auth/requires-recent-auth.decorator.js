"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequiresRecentAuth = exports.REQUIRES_RECENT_AUTH_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REQUIRES_RECENT_AUTH_KEY = 'requiresRecentAuth';
const RequiresRecentAuth = (reason) => (0, common_1.SetMetadata)(exports.REQUIRES_RECENT_AUTH_KEY, reason);
exports.RequiresRecentAuth = RequiresRecentAuth;
//# sourceMappingURL=requires-recent-auth.decorator.js.map