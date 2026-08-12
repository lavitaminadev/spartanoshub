import { Repository } from 'typeorm';
import { Service } from './service.entity';
import { Pack } from './pack.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { CreatePackDto } from './dto/create-pack.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/quote.dto';
export declare class CatalogController {
    private serviceRepo;
    private packRepo;
    private readonly quotes;
    constructor(serviceRepo: Repository<Service>, packRepo: Repository<Pack>, quotes: QuotesService);
    listServices(req: AuthenticatedRequest): Promise<Service[]>;
    createService(dto: CreateServiceDto, req: AuthenticatedRequest): Promise<Service>;
    updateService(id: string, dto: CreateServiceDto, req: AuthenticatedRequest): Promise<Service>;
    deleteService(id: string, req: AuthenticatedRequest): Promise<Service>;
    listPacks(req: AuthenticatedRequest): Promise<Pack[]>;
    createPack(dto: CreatePackDto, req: AuthenticatedRequest): Promise<Pack>;
    updatePack(id: string, dto: CreatePackDto, req: AuthenticatedRequest): Promise<Pack>;
    deletePack(id: string, req: AuthenticatedRequest): Promise<{
        deleted: boolean;
    }>;
    listQuotes(req: AuthenticatedRequest): Promise<import("./quote.entity").Quote[]>;
    createQuote(dto: CreateQuoteDto, req: AuthenticatedRequest): Promise<import("./quote.entity").Quote>;
    updateQuote(id: string, dto: UpdateQuoteDto, req: AuthenticatedRequest): Promise<import("./quote.entity").Quote>;
    createQuoteVersion(id: string, req: AuthenticatedRequest): Promise<import("./quote.entity").Quote>;
    sendQuote(id: string, req: AuthenticatedRequest): Promise<import("./quote.entity").Quote>;
    acceptQuote(id: string, req: AuthenticatedRequest): Promise<{
        quote: import("./quote.entity").Quote;
        client: import("../clients/client.entity").Client;
        contract: import("../contracts/contract.entity").Contract;
    }>;
}
