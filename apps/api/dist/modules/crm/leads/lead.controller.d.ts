import { Repository } from 'typeorm';
import { CreateLeadUseCase } from './use-cases/create-lead.use-case';
import { ListLeadsUseCase } from './use-cases/list-leads.use-case';
import { ConvertLeadUseCase } from './use-cases/convert-lead.use-case';
import { UpdateLeadUseCase } from './use-cases/update-lead.use-case';
import { GetLeadUseCase } from './use-cases/get-lead.use-case';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Reservation } from '../../reservations/domain/reservation.entity';
import { Lead } from './lead.entity';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
export declare class LeadController {
    private createLead;
    private listLeads;
    private getLead;
    private convertLead;
    private updateLead;
    private readonly reservationRepository;
    private readonly accountAccess;
    constructor(createLead: CreateLeadUseCase, listLeads: ListLeadsUseCase, getLead: GetLeadUseCase, convertLead: ConvertLeadUseCase, updateLead: UpdateLeadUseCase, reservationRepository: Repository<Reservation>, accountAccess: AccountAccessService);
    create(dto: CreateLeadDto, req: AuthenticatedRequest): Promise<Lead>;
    list(query: ListLeadsQueryDto, req: AuthenticatedRequest): Promise<import("./use-cases/list-leads.use-case").ListLeadsResult>;
    getById(id: string, req: AuthenticatedRequest): Promise<Lead>;
    update(id: string, dto: UpdateLeadDto, req: AuthenticatedRequest): Promise<Lead>;
    private assertLeadAccess;
    reservations(id: string, req: AuthenticatedRequest): Promise<Reservation[]>;
    convert(id: string, req: AuthenticatedRequest): Promise<{
        lead: Lead;
        client: import("../../clients/client.entity").Client;
    }>;
}
