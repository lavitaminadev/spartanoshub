import { PieceType } from '../piece-type.enum';
export declare class CreatePieceDto {
    clientId: string;
    title: string;
    type: PieceType;
    difficultyLevel?: number;
    carouselSlides?: number;
    deadlineAt?: string;
    dependencyIds?: string[];
    description?: string;
}
