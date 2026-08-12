import { HttpService } from '@nestjs/axios';
export interface ConversionEvent {
    eventName: string;
    eventTime: number;
    eventSourceUrl?: string;
    actionSource?: string;
    userData: {
        em?: string[];
        ph?: string[];
        fn?: string[];
        ln?: string[];
        client_ip_address?: string;
        client_user_agent?: string;
        fbc?: string;
        fbp?: string;
        externalId?: string[];
        ct?: string[];
        st?: string[];
        country?: string[];
    };
    customData?: {
        currency?: string;
        value?: number;
        contentIds?: string[];
        contentType?: string;
    };
    eventId?: string;
}
export declare class MetaConversionsService {
    private readonly http;
    private readonly logger;
    constructor(http: HttpService);
    sendEvent(pixelId: string, accessToken: string, event: ConversionEvent): Promise<any>;
    sendServerEvent(pixelId: string, accessToken: string, event: ConversionEvent): Promise<any>;
}
