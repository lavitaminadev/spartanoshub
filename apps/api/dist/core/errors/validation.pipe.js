"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationPipe = void 0;
const common_1 = require("@nestjs/common");
function flatten(errors, path = '') {
    return errors.flatMap((error) => {
        const field = path ? `${path}.${error.property}` : error.property;
        const own = Object.values(error.constraints || {});
        const nested = error.children?.length ? flatten(error.children, field) : [];
        return [...own.map((message) => ({ field, message })), ...nested];
    });
}
class ValidationPipe extends common_1.ValidationPipe {
    constructor() {
        super({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: (validationErrors) => {
                const errors = flatten(validationErrors);
                return new common_1.BadRequestException({
                    message: 'Validation failed',
                    errors,
                });
            },
        });
    }
}
exports.ValidationPipe = ValidationPipe;
