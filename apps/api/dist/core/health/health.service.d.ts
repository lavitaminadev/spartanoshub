import { DataSource } from 'typeorm';
export declare class HealthService {
    private dataSource;
    constructor(dataSource: DataSource);
    check(): Promise<{
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
    checkDb(): Promise<{
        status: string;
        connected: boolean;
        message?: undefined;
    } | {
        status: string;
        connected: boolean;
        message: any;
    }>;
    checkMemory(): Promise<{
        status: string;
        freeMb: number;
        totalMb: number;
        usagePercent: string;
    }>;
    checkDisk(): Promise<{
        status: string;
        writable: boolean;
        message?: undefined;
    } | {
        status: string;
        writable: boolean;
        message: any;
    }>;
    checkRedis(): Promise<{
        status: string;
        connected: boolean;
        url?: undefined;
    } | {
        status: string;
        connected: null;
        url: string | undefined;
    }>;
}
