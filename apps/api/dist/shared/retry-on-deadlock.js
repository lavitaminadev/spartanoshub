"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryOnDeadlock = retryOnDeadlock;
const common_1 = require("@nestjs/common");
const logger = new common_1.Logger('RetryOnDeadlock');
const RETRYABLE_ERRNOS = new Set([1213, 1205]);
const DEFAULT_ATTEMPTS = 3;
function isRetryable(error) {
    const errno = error?.errno;
    return typeof errno === 'number' && RETRYABLE_ERRNOS.has(errno);
}
function backoffMs(attempt) {
    return 25 * 2 ** (attempt - 1) + Math.floor(Math.random() * 25);
}
async function retryOnDeadlock(operation, work, attempts = DEFAULT_ATTEMPTS) {
    for (let attempt = 1;; attempt += 1) {
        try {
            return await work();
        }
        catch (error) {
            if (!isRetryable(error) || attempt >= attempts)
                throw error;
            const wait = backoffMs(attempt);
            logger.warn(`${operation}: interbloqueo en el intento ${attempt} de ${attempts}, reintentando en ${wait} ms`);
            await new Promise((resolve) => setTimeout(resolve, wait));
        }
    }
}
