import { Repository } from 'typeorm';
import { Invoice } from '../invoice.entity';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import type { AuthenticatedRequest } from '@shared/types/request';
export declare class CreateInvoiceUseCase {
    private readonly repo;
    private readonly accountAccess;
    constructor(repo: Repository<Invoice>, accountAccess: AccountAccessService);
    execute(dto: CreateInvoiceDto, organizationId: string, user: AuthenticatedRequest['user']): Promise<Invoice>;
}
