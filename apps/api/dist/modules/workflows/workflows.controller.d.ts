import type { AuthenticatedRequest } from '@shared/types/request';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowsService } from './workflows.service';
export declare class WorkflowsController {
    private readonly workflows;
    constructor(workflows: WorkflowsService);
    list(req: AuthenticatedRequest): Promise<import("./workflow-template.entity").WorkflowTemplate[]>;
    update(id: string, dto: UpdateWorkflowDto, req: AuthenticatedRequest): Promise<import("./workflow-template.entity").WorkflowTemplate>;
    reset(code: string, req: AuthenticatedRequest): Promise<import("./workflow-template.entity").WorkflowTemplate>;
}
