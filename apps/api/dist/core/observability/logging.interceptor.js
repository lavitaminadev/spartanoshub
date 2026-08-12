"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const logger_service_1 = require("./logger.service");
const metrics_service_1 = require("./metrics.service");
let LoggingInterceptor = class LoggingInterceptor {
    constructor(logger, metrics) {
        this.logger = logger;
        this.metrics = metrics;
    }
    intercept(context, next) {
        const http = context.switchToHttp();
        const request = http.getRequest();
        const response = http.getResponse();
        const requestId = request.requestId ?? 'unknown';
        const { method, url } = request;
        const userId = request.user?.id;
        const organizationId = request.organizationId;
        this.logger.setRequestId(requestId);
        if (userId)
            this.logger.setUserId(userId);
        if (organizationId)
            this.logger.setOrganizationId(organizationId);
        this.metrics.incrementRequestCount();
        if (userId)
            this.metrics.trackActiveUser(userId);
        this.logger.log(`--> ${method} ${url}`, 'HTTP');
        const start = Date.now();
        return next.handle().pipe((0, rxjs_1.tap)({
            next: () => {
                const responseTime = Date.now() - start;
                this.metrics.trackResponseTime(responseTime);
                this.logger.log(`<-- ${method} ${url} ${response.statusCode} ${responseTime}ms`, 'HTTP');
            },
            error: (error) => {
                const responseTime = Date.now() - start;
                this.metrics.incrementErrorCount();
                this.metrics.trackResponseTime(responseTime);
                const status = error.status || 500;
                this.logger.error(`<-- ${method} ${url} ${status} ${responseTime}ms - ${error.message}`, error.stack, 'HTTP');
            },
        }));
    }
};
exports.LoggingInterceptor = LoggingInterceptor;
exports.LoggingInterceptor = LoggingInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService,
        metrics_service_1.MetricsService])
], LoggingInterceptor);
