import { PieceType } from '../../production/piece-type.enum';
import { WorkRequestArea, WorkRequestStatus, type WorkRequestPriority } from '../work-request.entity';
export declare class CreateWorkRequestDto {
    clientId: string;
    area: WorkRequestArea;
    title: string;
    description?: string;
    priority?: WorkRequestPriority;
    neededBy?: string;
    creativeFields?: Record<string, unknown>;
    operationalFields?: Record<string, unknown>;
}
export declare class UpdateWorkRequestDto {
    status?: WorkRequestStatus;
    assignedTo?: string;
    priority?: WorkRequestPriority;
    rejectionReason?: string;
    operationalFields?: Record<string, unknown>;
}
export declare class ConvertPieceDto {
    title: string;
    type: PieceType;
    difficultyLevel?: number;
    carouselSlides?: number;
}
export declare class ConvertSessionDto {
    type: string;
    date: string;
    location?: string;
    assignedTeam?: string[];
    moodboardId?: string;
}
export declare class ResolveWorkRequestDto {
    pieces?: ConvertPieceDto[];
    session?: ConvertSessionDto;
}
