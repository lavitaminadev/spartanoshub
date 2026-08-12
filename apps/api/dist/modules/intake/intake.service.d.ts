import { DataSource, Repository } from 'typeorm';
import { WorkRequest, WorkRequestArea, WorkRequestStatus } from './work-request.entity';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { CreateWorkRequestDto, ResolveWorkRequestDto, UpdateWorkRequestDto } from './dto/work-request.dto';
export declare class IntakeService {
    private readonly requests;
    private readonly clients;
    private readonly users;
    private readonly dataSource;
    constructor(requests: Repository<WorkRequest>, clients: Repository<Client>, users: Repository<User>, dataSource: DataSource);
    create(organizationId: string, requestedBy: string, dto: CreateWorkRequestDto, allowedClientIds?: string[]): Promise<WorkRequest>;
    list(organizationId: string, filters: {
        status?: WorkRequestStatus;
        area?: string;
        clientId?: string;
        mine?: string;
    }, allowedClientIds?: string[]): Promise<{
        data: WorkRequest[];
        total: number;
    }>;
    findOne(organizationId: string, id: string, allowedClientIds?: string[]): Promise<WorkRequest>;
    update(organizationId: string, id: string, dto: UpdateWorkRequestDto, allowedClientIds?: string[]): Promise<WorkRequest>;
    convert(organizationId: string, id: string, dto: ResolveWorkRequestDto, allowedClientIds?: string[]): Promise<WorkRequest>;
    private convertToPieces;
    private convertToSession;
    private assertActiveUsers;
    assigneeOptions(organizationId: string, area: WorkRequestArea): Promise<User[]>;
    counts(organizationId: string, allowedClientIds?: string[]): Promise<Record<string, number>>;
    private assertClient;
    private clientScope;
}
