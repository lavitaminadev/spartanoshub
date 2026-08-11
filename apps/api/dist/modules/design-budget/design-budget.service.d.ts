import { EntityManager, Repository } from 'typeorm';
import { UDBudget } from './ud-budget.entity';
import { UDMovement } from './ud-movement.entity';
import { Piece } from '../production/piece.entity';
import { Client } from '../clients/client.entity';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';
import { BudgetAlertDto } from './dto/budget-alert.dto';
export declare class DesignBudgetService {
    private budgetRepo;
    private movementRepo;
    private clientRepo;
    private parameterResolver;
    constructor(budgetRepo: Repository<UDBudget>, movementRepo: Repository<UDMovement>, clientRepo: Repository<Client>, parameterResolver: ParameterResolver);
    ensureMonthlyBudget(clientId: string, year: number, month: number, manager?: EntityManager): Promise<UDBudget>;
    calculateForPiece(pieceType: string, carouselSlides?: number): number;
    reserveForPiece(piece: Piece, actorId?: string, transactionManager?: EntityManager): Promise<UDMovement>;
    confirmConsumption(piece: Piece, actorId?: string, transactionManager?: EntityManager): Promise<UDMovement>;
    isNearLimit(budget: UDBudget, thresholdPercent?: number): Promise<boolean>;
    checkBudgetAlert(clientId: string, clientName?: string): Promise<BudgetAlertDto>;
    private resolveMonthlyBudget;
    private resolveOrganizationId;
}
