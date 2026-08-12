import type { WorkflowStep } from './workflow-template.entity';
export declare const WORKFLOW_DEFAULTS: Record<string, {
    name: string;
    description: string;
    steps: WorkflowStep[];
}>;
