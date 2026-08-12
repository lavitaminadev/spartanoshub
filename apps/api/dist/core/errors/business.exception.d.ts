import { HttpException } from '@nestjs/common';
export declare class BusinessException extends HttpException {
    constructor(message: string, code: string, statusCode?: number);
}
export declare class UdBudgetExceededException extends BusinessException {
    constructor(message?: string);
}
export declare class MaxCorrectionsExceededException extends BusinessException {
    constructor(message?: string);
}
export declare class NamingInvalidException extends BusinessException {
    constructor(message?: string);
}
export declare class LeadAlreadyConvertedException extends BusinessException {
    constructor(message?: string);
}
export declare class OrganizationQuotaExceededException extends BusinessException {
    constructor(message?: string);
}
