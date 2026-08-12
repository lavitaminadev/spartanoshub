export interface MetaSignedRequestPayload {
    algorithm: string;
    user_id: string;
    issued_at?: number;
}
interface DeletionConfirmationPayload {
    userId: string;
    completedAt: string;
}
export declare function parseMetaSignedRequest(signedRequest: string, appSecret: string): MetaSignedRequestPayload;
export declare function createDeletionConfirmation(userId: string, appSecret: string): string;
export declare function verifyDeletionConfirmation(code: string, appSecret: string): DeletionConfirmationPayload;
export {};
