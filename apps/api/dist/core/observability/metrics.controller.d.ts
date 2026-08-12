import { MetricsService } from './metrics.service';
export declare class MetricsController {
    private readonly metrics;
    constructor(metrics: MetricsService);
    getMetrics(): {
        requestCount: number;
        errorCount: number;
        errorRate: number;
        averageResponseTimeMs: number;
        activeUsers: number;
        uptimeSeconds: number;
        timestamp: string;
    };
}
