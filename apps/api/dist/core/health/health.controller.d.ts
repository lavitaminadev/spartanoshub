import type { Response } from 'express';
import { HealthService } from './health.service';
import { IntegrationsHealthService } from './integrations-health.service';
export declare class HealthController {
    private readonly health;
    private readonly integrationsHealth;
    constructor(health: HealthService, integrationsHealth: IntegrationsHealthService);
    check(res: Response): Promise<{
        status: string;
        timestamp: string;
        version: string;
    }>;
    details(res: Response): Promise<{
        status: string;
        uptime: number;
        timestamp: string;
        version: string;
        database: {
            status: string;
            connected: boolean;
            message?: undefined;
        } | {
            status: string;
            connected: boolean;
            message: any;
        };
        memory: {
            status: string;
            freeMb: number;
            totalMb: number;
            usagePercent: string;
        };
        disk: {
            status: string;
            writable: boolean;
            message?: undefined;
        } | {
            status: string;
            writable: boolean;
            message: any;
        };
        redis: {
            status: string;
            connected: boolean;
            url?: undefined;
        } | {
            status: string;
            connected: null;
            url: string | undefined;
        };
    }>;
    db(): Promise<{
        status: string;
        connected: boolean;
        message?: undefined;
    } | {
        status: string;
        connected: boolean;
        message: any;
    }>;
    integrations(): Promise<Record<string, any>>;
}
