"use strict";
/**
 * @fileoverview Domain constants shared across the Espartanos monorepo.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_FILE_TYPES = exports.FILE_MAX_SIZE_BYTES = exports.MEETING_MAX_DURATION_MINUTES = exports.MEETING_MIN_DURATION_MINUTES = exports.XP_STREAK_BONUS_MULTIPLIER = exports.TOKEN_EXPIRATION_REFRESH = exports.TOKEN_EXPIRATION_ACCESS = exports.DIFFICULTY_MAX = exports.DIFFICULTY_MIN = exports.UD_BUDGET_DEFAULT = exports.PAGINATION_MAX_LIMIT = exports.PAGINATION_DEFAULT_LIMIT = exports.PAGINATION_DEFAULT_PAGE = exports.API_VERSION = void 0;
/** API version prefix used by backend routes. */
exports.API_VERSION = 'v1';
/** Default 1-based page for paginated requests. */
exports.PAGINATION_DEFAULT_PAGE = 1;
/** Default page size for paginated requests. */
exports.PAGINATION_DEFAULT_LIMIT = 20;
/** Maximum page size allowed for paginated requests. */
exports.PAGINATION_MAX_LIMIT = 100;
/** Default UD budget assigned to a new client. */
exports.UD_BUDGET_DEFAULT = 20;
/** Minimum difficulty level for a piece. */
exports.DIFFICULTY_MIN = 1;
/** Maximum difficulty level for a piece. */
exports.DIFFICULTY_MAX = 5;
/** JWT access token expiry expression. */
exports.TOKEN_EXPIRATION_ACCESS = '15m';
/** JWT refresh token expiry expression. */
exports.TOKEN_EXPIRATION_REFRESH = '7d';
/** Multiplier applied to streak bonus XP. */
exports.XP_STREAK_BONUS_MULTIPLIER = 1.5;
/** Shortest allowed meeting duration in minutes. */
exports.MEETING_MIN_DURATION_MINUTES = 15;
/** Longest allowed meeting duration in minutes. */
exports.MEETING_MAX_DURATION_MINUTES = 180;
/** Maximum allowed file upload size in bytes (50 MB). */
exports.FILE_MAX_SIZE_BYTES = 50 * 1024 * 1024;
/** MIME types accepted for file uploads. */
exports.ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'];
__exportStar(require("./industries"), exports);
__exportStar(require("./lead-sources"), exports);
__exportStar(require("./modules"), exports);
//# sourceMappingURL=index.js.map