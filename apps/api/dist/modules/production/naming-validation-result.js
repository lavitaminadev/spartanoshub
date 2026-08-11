"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NamingValidationResult = void 0;
class NamingValidationResult {
    constructor(fileName, isValid, errors = []) {
        this.fileName = fileName;
        this.isValid = isValid;
        this.errors = errors;
    }
}
exports.NamingValidationResult = NamingValidationResult;
//# sourceMappingURL=naming-validation-result.js.map