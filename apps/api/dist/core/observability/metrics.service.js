"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
let MetricsService = class MetricsService {
    constructor() {
        this.state = {
            requestCount: 0,
            errorCount: 0,
            totalResponseTime: 0,
            responseTimeCount: 0,
            averageResponseTime: 0,
            activeUsers: new Set(),
            startTime: Date.now(),
        };
    }
    incrementRequestCount() {
        this.state.requestCount++;
    }
    incrementErrorCount() {
        this.state.errorCount++;
    }
    trackResponseTime(ms) {
        this.state.totalResponseTime += ms;
        this.state.responseTimeCount++;
        this.state.averageResponseTime = Math.round(this.state.totalResponseTime / this.state.responseTimeCount);
    }
    trackActiveUser(userId) {
        this.state.activeUsers.add(userId);
    }
    getMetrics() {
        return {
            requestCount: this.state.requestCount,
            errorCount: this.state.errorCount,
            errorRate: this.state.requestCount > 0
                ? Number(((this.state.errorCount / this.state.requestCount) *
                    100).toFixed(2))
                : 0,
            averageResponseTimeMs: this.state.averageResponseTime,
            activeUsers: this.state.activeUsers.size,
            uptimeSeconds: Math.floor((Date.now() - this.state.startTime) / 1000),
            timestamp: new Date().toISOString(),
        };
    }
    reset() {
        this.state = {
            requestCount: 0,
            errorCount: 0,
            totalResponseTime: 0,
            responseTimeCount: 0,
            averageResponseTime: 0,
            activeUsers: new Set(),
            startTime: Date.now(),
        };
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)()
], MetricsService);
//# sourceMappingURL=metrics.service.js.map