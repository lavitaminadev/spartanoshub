import { Repository } from 'typeorm';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Objective } from './objective.entity';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { CreateObjectiveDto, UpdateObjectiveDto } from './dto/objective.dto';
export declare class ObjectivesController {
    private readonly repo;
    private readonly clients;
    private readonly users;
    constructor(repo: Repository<Objective>, clients: Repository<Client>, users: Repository<User>);
    list(req: AuthenticatedRequest): Promise<Objective[]>;
    create(dto: CreateObjectiveDto, req: AuthenticatedRequest): Promise<Objective>;
    update(id: string, dto: UpdateObjectiveDto, req: AuthenticatedRequest): Promise<Objective>;
    private validateReferences;
}
