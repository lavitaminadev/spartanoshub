import { Repository } from 'typeorm';
import { Moodboard } from './moodboard.entity';
import { Session } from './session.entity';
import { CreateMoodboardDto } from './dto/create-moodboard.dto';
import { UpdateMoodboardDto } from './dto/update-moodboard.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
export declare class AudiovisualService {
    private readonly moodboardRepo;
    private readonly sessionRepo;
    private readonly clients;
    private readonly users;
    constructor(moodboardRepo: Repository<Moodboard>, sessionRepo: Repository<Session>, clients: Repository<Client>, users: Repository<User>);
    createMoodboard(dto: CreateMoodboardDto, organizationId: string, createdBy: string): Promise<Moodboard>;
    findAllMoodboards(organizationId: string, limit?: number, offset?: number): Promise<{
        data: Moodboard[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOneMoodboard(id: string, organizationId: string): Promise<Moodboard>;
    updateMoodboard(id: string, dto: UpdateMoodboardDto, organizationId: string): Promise<Moodboard>;
    removeMoodboard(id: string, organizationId: string): Promise<Moodboard>;
    createSession(dto: CreateSessionDto, organizationId: string): Promise<Session>;
    findAllSessions(organizationId: string, limit?: number, offset?: number, assignedTo?: string): Promise<{
        data: Session[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOneSession(id: string, organizationId: string): Promise<Session>;
    updateSession(id: string, dto: UpdateSessionDto, organizationId: string): Promise<Session>;
    removeSession(id: string, organizationId: string): Promise<Session>;
    private validateClient;
    private validateUsers;
    private validateSessionReferences;
}
