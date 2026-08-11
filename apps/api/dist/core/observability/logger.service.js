"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = void 0;
const common_1 = require("@nestjs/common");
let LoggerService = class LoggerService extends common_1.ConsoleLogger {
    setRequestId(requestId) {
        this.requestId = requestId;
    }
    setUserId(userId) {
        this.userId = userId;
    }
    setOrganizationId(organizationId) {
        this.organizationId = organizationId;
    }
    buildLogEntry(level, message, context, trace) {
        const entry = {
            level,
            timestamp: new Date().toISOString(),
            context: context || this.context,
            message: typeof message === 'string' ? message : JSON.stringify(message),
        };
        if (this.requestId)
            entry.requestId = this.requestId;
        if (this.userId)
            entry.userId = this.userId;
        if (this.organizationId)
            entry.organizationId = this.organizationId;
        if (trace)
            entry.trace = trace;
        return entry;
    }
    log(message, context) {
        if (process.env.NODE_ENV === 'production') {
            const entry = this.buildLogEntry('info', message, context);
            process.stdout.write(JSON.stringify(entry) + '\n');
        }
        else {
            super.log(message, context);
        }
    }
    info(message, context) {
        this.log(message, context);
    }
    warn(message, context) {
        if (process.env.NODE_ENV === 'production') {
            const entry = this.buildLogEntry('warn', message, context);
            process.stdout.write(JSON.stringify(entry) + '\n');
        }
        else {
            super.warn(message, context);
        }
    }
    error(message, trace, context) {
        if (process.env.NODE_ENV === 'production') {
            const entry = this.buildLogEntry('error', message, context, trace);
            process.stderr.write(JSON.stringify(entry) + '\n');
        }
        else {
            super.error(message, trace, context);
        }
    }
    debug(message, context) {
        if (process.env.NODE_ENV !== 'production') {
            super.debug(message, context);
        }
    }
};
exports.LoggerService = LoggerService;
exports.LoggerService = LoggerService = __decorate([
    (0, common_1.Injectable)()
], LoggerService);
//# sourceMappingURL=logger.service.js.map