import { Repository } from 'typeorm';
import { WorkflowTemplate, type WorkflowStep } from './workflow-template.entity';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
export declare class WorkflowsService {
    private readonly templates;
    constructor(templates: Repository<WorkflowTemplate>);
    list(organizationId: string): Promise<WorkflowTemplate[]>;
    getSteps(organizationId: string, code: string): Promise<WorkflowStep[]>;
    update(id: string, organizationId: string, dto: UpdateWorkflowDto): Promise<WorkflowTemplate>;
    reset(code: string, organizationId: string): Promise<WorkflowTemplate>;
    private ensureDefaults;
}
