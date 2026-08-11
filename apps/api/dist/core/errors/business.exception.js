"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationQuotaExceededException = exports.LeadAlreadyConvertedException = exports.NamingInvalidException = exports.MaxCorrectionsExceededException = exports.UdBudgetExceededException = exports.BusinessException = void 0;
const common_1 = require("@nestjs/common");
class BusinessException extends common_1.HttpException {
    constructor(message, code, statusCode = 400) {
        super({ message, code, statusCode }, statusCode);
    }
}
exports.BusinessException = BusinessException;
class UdBudgetExceededException extends BusinessException {
    constructor(message = 'UD budget exceeded for this client') {
        super(message, 'UD_BUDGET_EXCEEDED', 400);
    }
}
exports.UdBudgetExceededException = UdBudgetExceededException;
class MaxCorrectionsExceededException extends BusinessException {
    constructor(message = 'Maximum corrections (3) exceeded') {
        super(message, 'MAX_CORRECTIONS_EXCEEDED', 400);
    }
}
exports.MaxCorrectionsExceededException = MaxCorrectionsExceededException;
class NamingInvalidException extends BusinessException {
    constructor(message = 'File naming convention is invalid') {
        super(message, 'NAMING_INVALID', 400);
    }
}
exports.NamingInvalidException = NamingInvalidException;
class LeadAlreadyConvertedException extends BusinessException {
    constructor(message = 'Lead has already been converted') {
        super(message, 'LEAD_ALREADY_CONVERTED', 409);
    }
}
exports.LeadAlreadyConvertedException = LeadAlreadyConvertedException;
class OrganizationQuotaExceededException extends BusinessException {
    constructor(message = 'Organization quota exceeded') {
        super(message, 'ORGANIZATION_QUOTA_EXCEEDED', 403);
    }
}
exports.OrganizationQuotaExceededException = OrganizationQuotaExceededException;
//# sourceMappingURL=business.exception.js.map