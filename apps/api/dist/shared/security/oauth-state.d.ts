interface OAuthStatePayload {
    provider: 'meta' | 'google';
    organizationId: string;
    redirectUri: string;
    expiresAt: number;
    nonce: string;
}
export declare function createOAuthState(provider: OAuthStatePayload['provider'], organizationId: string, redirectUri: string): string;
export declare function verifyOAuthState(state: string, expected: Pick<OAuthStatePayload, 'provider' | 'organizationId' | 'redirectUri'>): void;
export {};
