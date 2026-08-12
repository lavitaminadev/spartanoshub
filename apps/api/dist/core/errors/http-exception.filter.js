"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var HttpExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let HttpExceptionFilter = HttpExceptionFilter_1 = class HttpExceptionFilter {
    constructor() {
        this.logger = new common_1.Logger(HttpExceptionFilter_1.name);
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const requestId = request.requestId || 'N/A';
        let statusCode = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let errors;
        if (exception instanceof common_1.HttpException) {
            statusCode = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            }
            else if (typeof exceptionResponse === 'object') {
                const resp = exceptionResponse;
                if (exception instanceof common_1.BadRequestException && Array.isArray(resp.message)) {
                    errors = this.formatValidationErrors(resp.message);
                    message = 'Validation failed';
                }
                else {
                    message = resp.message || exception.message;
                }
                if (resp.errors && Array.isArray(resp.errors)) {
                    errors = resp.errors;
                }
            }
        }
        else if (exception instanceof typeorm_1.QueryFailedError) {
            const driverError = exception.driverError;
            if (driverError.code === 'ER_DUP_ENTRY' || driverError.errno === 1062) {
                statusCode = common_1.HttpStatus.CONFLICT;
                message = 'Ya existe un registro con esos datos';
            }
            else if (driverError.code === 'ER_NO_REFERENCED_ROW_2' || driverError.errno === 1452) {
                statusCode = common_1.HttpStatus.BAD_REQUEST;
                message = 'La referencia indicada no existe';
            }
            else if (driverError.code === 'ER_ROW_IS_REFERENCED_2' || driverError.errno === 1451) {
                statusCode = common_1.HttpStatus.CONFLICT;
                message = 'El registro tiene información asociada y no se puede eliminar';
            }
        }
        const isProduction = process.env.NODE_ENV === 'production';
        if (!(exception instanceof common_1.HttpException)) {
            const detail = isProduction
                ? exception instanceof Error ? exception.name : 'Unknown exception'
                : exception instanceof Error ? exception.message : 'Unknown exception';
            const trace = !isProduction && exception instanceof Error ? exception.stack : undefined;
            this.logger.error(`[${requestId}] ${request.method} ${request.url}: ${detail}`, trace);
            if (!isProduction && statusCode === common_1.HttpStatus.INTERNAL_SERVER_ERROR && exception instanceof Error) {
                message = exception.message;
            }
        }
        const errorResponse = {
            statusCode,
            message,
            timestamp: new Date().toISOString(),
            path: request.url,
            requestId,
        };
        if (errors) {
            errorResponse.errors = errors;
        }
        if (!isProduction && exception instanceof Error) {
            errorResponse.stack = exception.stack;
        }
        response.status(statusCode).json(errorResponse);
    }
    formatValidationErrors(validationErrors) {
        const result = [];
        const extractErrors = (errs, parentPath = '') => {
            for (const err of errs) {
                const error = err;
                const fieldPath = parentPath
                    ? `${parentPath}.${error.property}`
                    : error.property || 'unknown';
                if (error.constraints) {
                    for (const constraint of Object.values(error.constraints)) {
                        result.push({ field: fieldPath, message: constraint });
                    }
                }
                if (error.children && error.children.length > 0) {
                    extractErrors(error.children, fieldPath);
                }
            }
        };
        extractErrors(validationErrors);
        return result;
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = HttpExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map