import { Repository } from 'typeorm';
import { Piece } from './piece.entity';
import { PieceVersion } from './piece-version.entity';
import { UserRole } from '../organizations/user-role.enum';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';
export declare class SubmitVersionUseCase {
    private pieceRepo;
    private versionRepo;
    private readonly parameters;
    constructor(pieceRepo: Repository<Piece>, versionRepo: Repository<PieceVersion>, parameters: ParameterResolver);
    execute(pieceId: string, organizationId: string, data: {
        fileName: string;
        driveFileId?: string;
        userId: string;
        role: UserRole;
    }): Promise<PieceVersion>;
}
