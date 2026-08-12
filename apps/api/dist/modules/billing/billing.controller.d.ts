import type { AuthenticatedRequest } from '@shared/types/request';
import { CreateInvoiceUseCase } from './use-cases/create-invoice.use-case';
import { ListInvoicesUseCase } from './use-cases/list-invoices.use-case';
import { ListChargeNotesUseCase } from './use-cases/list-charge-notes.use-case';
import { PriceChargeNoteUseCase } from './use-cases/price-charge-note.use-case';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { PriceChargeNoteDto } from './dto/price-charge-note.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
export declare class BillingController {
    private createInvoice;
    private listInvoices;
    private listChargeNotes;
    private priceChargeNote;
    constructor(createInvoice: CreateInvoiceUseCase, listInvoices: ListInvoicesUseCase, listChargeNotes: ListChargeNotesUseCase, priceChargeNote: PriceChargeNoteUseCase);
    create(dto: CreateInvoiceDto, req: AuthenticatedRequest): Promise<import("./invoice.entity").Invoice>;
    list(pagination: PaginationDto, req: AuthenticatedRequest): Promise<{
        data: import("./invoice.entity").Invoice[];
        total: number;
        limit: number;
        offset: number;
    }>;
    chargeNotes(req: AuthenticatedRequest): Promise<import("./charge-note.entity").ChargeNote[]>;
    priceNote(id: string, body: PriceChargeNoteDto, req: AuthenticatedRequest): Promise<import("./charge-note.entity").ChargeNote>;
}
