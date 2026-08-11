import { AudiovisualService } from './audiovisual.service';
import { CreateMoodboardDto } from './dto/create-moodboard.dto';
import { UpdateMoodboardDto } from './dto/update-moodboard.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
export declare class AudiovisualController {
    private service;
    constructor(service: AudiovisualService);
    createMoodboard(dto: CreateMoodboardDto, req: AuthenticatedRequest): Promise<import("./moodboard.entity").Moodboard>;
    findAllMoodboards(query: PaginationDto, req: AuthenticatedRequest): Promise<{
        data: import("./moodboard.entity").Moodboard[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOneMoodboard(id: string, req: AuthenticatedRequest): Promise<import("./moodboard.entity").Moodboard>;
    updateMoodboard(id: string, dto: UpdateMoodboardDto, req: AuthenticatedRequest): Promise<import("./moodboard.entity").Moodboard>;
    removeMoodboard(id: string, req: AuthenticatedRequest): Promise<import("./moodboard.entity").Moodboard>;
    createSession(dto: CreateSessionDto, req: AuthenticatedRequest): Promise<import("./session.entity").Session>;
    findAllSessions(query: PaginationDto, req: AuthenticatedRequest): Promise<{
        data: import("./session.entity").Session[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOneSession(id: string, req: AuthenticatedRequest): Promise<import("./session.entity").Session>;
    updateSession(id: string, dto: UpdateSessionDto, req: AuthenticatedRequest): Promise<import("./session.entity").Session>;
    removeSession(id: string, req: AuthenticatedRequest): Promise<import("./session.entity").Session>;
}
