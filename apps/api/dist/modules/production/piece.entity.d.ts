import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
import { PieceStatus } from './piece-status.enum';
import { PieceType } from './piece-type.enum';
export declare class Piece {
    id: string;
    organizationId: string;
    organization: Organization;
    clientId: string;
    client: Client;
    assignedTo?: string;
    assignedAt?: Date;
    startedAt?: Date;
    type: PieceType;
    title: string;
    status: PieceStatus;
    difficultyLevel: number;
    udAmount: number;
    deadlineAt?: Date;
    dependencyIds?: string[];
    deliveredAt?: Date;
    correctionCount: number;
    clientCorrectionCount: number;
    driveLink?: string;
    staleAlertedAt?: Date;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}
