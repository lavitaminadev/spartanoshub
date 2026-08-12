export declare class MetaOAuthCallbackDto {
    code: string;
    redirectUri: string;
    state: string;
}
export declare class MetaLeadSyncDto {
    pageId: string;
    leadgenId: string;
}
export declare class MetaPixelDto {
    pixelId: string;
}
export declare class MetaClientPixelDto extends MetaPixelDto {
    clientId: string;
    pixelName?: string;
    accessToken?: string;
}
export declare class MetaClientPixelSetupDto {
    clientId: string;
    mode: 'none' | 'manual' | 'existing';
    pixelId?: string;
    existingPixelId?: string;
    pixelName?: string;
    accessToken?: string;
}
export declare class MetaAssetSelectionDto {
    pageIds?: string[];
    instagramProfileIds?: string[];
    adAccountIds?: string[];
    primaryPageId?: string | null;
    primaryInstagramProfileId?: string | null;
    primaryAdAccountId?: string | null;
}
