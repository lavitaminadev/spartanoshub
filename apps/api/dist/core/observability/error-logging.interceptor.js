"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorLoggingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
let ErrorLoggingInterceptor = class ErrorLoggingInterceptor {
    constructor() {
        this.logger = new common_1.Logger('ErrorLogging');
    }
    intercept(context, next) {
        const req = context.switchToHttp().getRequest();
        const res = context.switchToHttp().getResponse();
        const startTime = Date.now();
        const requestId = req.requestId ?? 'unknown';
        return next.handle().pipe((0, operators_1.tap)(() => {
            const duration = Date.now() - startTime;
            if (duration > 1000) {
                this.logger.warn(`[${requestId}] SLOW REQUEST: ${req.method} ${req.path} (${duration}ms)`);
            }
        }), (0, operators_1.catchError)((error) => {
            const duration = Date.now() - startTime;
            const statusCode = error.status || res.statusCode || 500;
            const errorContext = {
                requestId,
                method: req.method,
                path: req.path,
                statusCode,
                duration,
                userId: req.user?.id,
                organizationId: req.organizationId,
                error: error.message,
                stack: error.stack?.split('\n').slice(0, 5).join('\n'),
            };
            if (statusCode >= 500) {
                this.logger.error(`[${requestId}] SERVER ERROR: ${JSON.stringify(errorContext)}`);
            }
            else if (statusCode >= 400) {
                this.logger.warn(`[${requestId}] CLIENT ERROR: ${error.message}`);
            }
            return (0, rxjs_1.throwError)(() => error);
        }));
    }
};
exports.ErrorLoggingInterceptor = ErrorLoggingInterceptor;
exports.ErrorLoggingInterceptor = ErrorLoggingInterceptor = __decorate([
    (0, common_1.Injectable)()
], ErrorLoggingInterceptor);
