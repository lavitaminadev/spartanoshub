export declare class NamingValidationResult {
    readonly fileName: string;
    readonly isValid: boolean;
    readonly errors: string[];
    constructor(fileName: string, isValid: boolean, errors?: string[]);
}
