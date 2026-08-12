export declare class WorkflowStepDto {
    key: string;
    label: string;
    responsibleRole?: string;
    slaHours?: number;
    required: boolean;
}
export declare class UpdateWorkflowDto {
    name?: string;
    description?: string;
    isActive?: boolean;
    steps?: WorkflowStepDto[];
}
