"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequiresFeature = exports.REQUIRES_FEATURE_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REQUIRES_FEATURE_KEY = 'requiresFeature';
const RequiresFeature = (feature) => (0, common_1.SetMetadata)(exports.REQUIRES_FEATURE_KEY, feature);
exports.RequiresFeature = RequiresFeature;
//# sourceMappingURL=requires-feature.decorator.js.map