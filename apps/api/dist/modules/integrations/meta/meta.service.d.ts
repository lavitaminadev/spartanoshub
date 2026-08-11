import { HttpService } from "@nestjs/axios";
type MetaPayload = {
    object?: string;
    entry?: Array<{
        id: string;
        time?: number;
        messaging?: Array<{
            sender: {
                id: string;
            };
            recipient: {
                id: string;
            };
            timestamp: number;
            message?: {
                mid: string;
                text?: string;
                attachments?: Array<{
                    type: string;
                    payload?: {
                        url?: string;
                    };
                }>;
            };
        }>;
    }>;
};
export interface InboundMessage {
    eventId: string;
    providerMessageId: string;
    tenantId: string;
    channel: string;
    channelAccountId: string;
    externalUserId: string;
    text?: string;
    attachments?: Array<{
        type: string;
        url?: string;
    }>;
    occurredAt: string;
}
export declare function verifyMetaSignature(rawBody: Buffer, signature: string, secret: string): boolean;
export declare class MetaService {
    private readonly http;
    constructor(http: HttpService);
    verify(rawBody: Buffer, signature: string): void;
    normalize(payload: MetaPayload): InboundMessage[];
    dispatch(messages: InboundMessage[]): Promise<{
        skipped: boolean;
        reason: string;
    }[] | {
        text?: string;
    }[]>;
    private sendInstagramText;
    refreshToken(accountId: string): Promise<boolean>;
}
export {};
