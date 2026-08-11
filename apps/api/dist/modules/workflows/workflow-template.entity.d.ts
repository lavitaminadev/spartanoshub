export interface WorkflowStep {
    key: string;
    label: string;
    responsibleRole?: string;
    slaHours?: number;
    required: boolean;
}
export declare class WorkflowTemplate {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    description?: string;
    steps: WorkflowStep[];
    isActive: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
