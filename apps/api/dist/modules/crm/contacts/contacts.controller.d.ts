import { ContactsService } from './contacts.service';
import { UpdateContactDto } from './dto/update-contact.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import type { AuthenticatedRequest } from '@shared/types/request';
export declare class ContactsController {
    private service;
    private readonly accountAccess;
    constructor(service: ContactsService, accountAccess: AccountAccessService);
    findAll(query: PaginationDto, clientId: string | undefined, req: AuthenticatedRequest): Promise<{
        data: import("./contact.entity").Contact[];
        total: number;
        limit: number;
        offset: number;
    }>;
    segments(clientId: string | undefined, req: AuthenticatedRequest): Promise<{
        id: string;
        label: string;
        count: number;
    }[]>;
    findOne(id: string, req: AuthenticatedRequest): Promise<import("./contact.entity").Contact>;
    update(id: string, dto: UpdateContactDto, req: AuthenticatedRequest): Promise<import("./contact.entity").Contact>;
}
