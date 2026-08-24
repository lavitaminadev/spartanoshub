"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.privateApiCacheMiddleware = privateApiCacheMiddleware;
function privateApiCacheMiddleware(_request, response, next) {
    response.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
    response.vary('Authorization');
    response.vary('Cookie');
    next();
}
