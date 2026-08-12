import type { AuthenticatedRequest } from '@shared/types/request';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { IntakeService } from './intake.service';
import { CreateWorkRequestDto, ResolveWorkRequestDto, UpdateWorkRequestDto } from './dto/work-request.dto';
import { WorkRequestArea, WorkRequestStatus } from './work-request.entity';
export declare class IntakeController {
    private readonly intake;
    private readonly accountAccess;
    constructor(intake: IntakeService, accountAccess: AccountAccessService);
    create(req: AuthenticatedRequest, dto: CreateWorkRequestDto): Promise<import("./work-request.entity").WorkRequest>;
    list(req: AuthenticatedRequest, status?: WorkRequestStatus, area?: string, clientId?: string, mine?: string): Promise<{
        data: import("./work-request.entity").WorkRequest[];
        total: number;
    }>;
    counts(req: AuthenticatedRequest): Promise<Record<string, number>>;
    assignees(req: AuthenticatedRequest, area: WorkRequestArea): Promise<import("../users/user.entity").User[]>;
    findOne(req: AuthenticatedRequest, id: string): Promise<import("./work-request.entity").WorkRequest>;
    update(req: AuthenticatedRequest, id: string, dto: UpdateWorkRequestDto): Promise<import("./work-request.entity").WorkRequest>;
    convert(req: AuthenticatedRequest, id: string, dto: ResolveWorkRequestDto): Promise<import("./work-request.entity").WorkRequest>;
}
