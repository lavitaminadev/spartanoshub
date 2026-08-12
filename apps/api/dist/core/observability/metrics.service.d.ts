export declare class MetricsService {
    private state;
    incrementRequestCount(): void;
    incrementErrorCount(): void;
    trackResponseTime(ms: number): void;
    trackActiveUser(userId: string): void;
    getMetrics(): {
        requestCount: number;
        errorCount: number;
        errorRate: number;
        averageResponseTimeMs: number;
        activeUsers: number;
        uptimeSeconds: number;
        timestamp: string;
    };
    reset(): void;
}
