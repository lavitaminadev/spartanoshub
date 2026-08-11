import { DataSource } from 'typeorm';
type Dimension = {
    key: string;
    label: string;
    score: number | null;
    weight: number;
    evidence: string;
    status: 'healthy' | 'attention' | 'blocked' | 'no_data';
};
type Action = {
    id: string;
    title: string;
    detail: string;
    priority: 'high' | 'medium' | 'low';
    owner: 'team' | 'client';
    route: string;
};
export declare class VitaminaPulseService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    getPulse(organizationId: string, clientId?: string, clientIds?: string[]): Promise<{
        score: number | null;
        coverage: number;
        status: "blocked" | "healthy" | "attention" | "no_data";
        stage: string;
        generatedAt: string;
        dimensions: Dimension[];
        actions: Action[];
        commitments: {
            team: number;
            client: number;
        };
        impact: {
            type: string;
            title: string;
            detail: string;
            happenedAt: string | Date;
        }[];
    }>;
}
export {};
