export declare class IntegrationsHealthService {
    checkMeta(): Promise<{
        status: string;
        configured: boolean;
    }>;
    checkGoogle(): Promise<{
        status: string;
        configured: boolean;
    }>;
    checkAll(): Promise<Record<string, any>>;
}
