import { NamingValidationResult } from './naming-validation-result';
export declare function validate(fileName: string, clientCode: string): NamingValidationResult;
export declare function isValid(fileName: string, clientCode: string): boolean;
export declare function extractState(fileName: string): string | null;
