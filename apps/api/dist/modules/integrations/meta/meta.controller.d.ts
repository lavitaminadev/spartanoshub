import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { MetaService } from "./meta.service";
import { MetaLeadAdsService } from "./meta-lead-ads.service";
import { MetaOAuthService } from "./meta-oauth.service";
import { MetaDataDeletionDto } from "./dto/data-deletion.dto";
export declare class MetaController {
    private readonly meta;
    private readonly metaLeadAds;
    private readonly oauth;
    constructor(meta: MetaService, metaLeadAds: MetaLeadAdsService, oauth: MetaOAuthService);
    dataDeletion(body: MetaDataDeletionDto, req: Request): Promise<{
        url: string;
        confirmation_code: string;
    }>;
    dataDeletionStatus(code?: string): {
        confirmationCode: string;
        status: string;
        completedAt: string;
        message: string;
    };
    verify(mode?: string, token?: string, challenge?: string): string | undefined;
    receive(req: RawBodyRequest<Request>, signature: string, payload: unknown): Promise<{
        accepted: number;
        replies: {
            skipped: boolean;
            reason: string;
        }[] | {
            text?: string;
        }[];
        leadResults: {
            accepted: number;
            createdOrUpdated: number;
        };
    }>;
}
