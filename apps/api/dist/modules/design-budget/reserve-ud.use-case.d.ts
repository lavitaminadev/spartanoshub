import { Repository } from 'typeorm';
import { UDBudget } from './ud-budget.entity';
import { UDMovement } from './ud-movement.entity';
export declare class ReserveUdUseCase {
    private budgetRepo;
    private movementRepo;
    constructor(budgetRepo: Repository<UDBudget>, movementRepo: Repository<UDMovement>);
    execute(organizationId: string, clientId: string, pieceId: string, amount: number, year: number, month: number): Promise<UDBudget>;
}
