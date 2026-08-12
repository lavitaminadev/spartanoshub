"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationPipe = void 0;
const common_1 = require("@nestjs/common");
class ValidationPipe extends common_1.ValidationPipe {
    constructor() {
        super({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: (validationErrors) => {
                const errors = validationErrors.map((error) => ({
                    field: error.property,
                    message: Object.values(error.constraints || {}).join(', '),
                }));
                return new common_1.BadRequestException({
                    message: 'Validation failed',
                    errors,
                });
            },
        });
    }
}
exports.ValidationPipe = ValidationPipe;
//# sourceMappingURL=validation.pipe.js.map