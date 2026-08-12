import { DataProtectionService } from './data-protection.service';
import type { AuthenticatedRequest, AuthUser } from '../../shared/types/request';
import { RecordConsentDto } from './dto/record-consent.dto';
export declare class DataProtectionController {
    private service;
    constructor(service: DataProtectionService);
    exportMyData(user: AuthUser): Promise<Record<string, unknown>>;
    anonymizeMe(user: AuthUser): Promise<{
        message: string;
    }>;
    recordConsent(user: AuthUser, body: RecordConsentDto, req: AuthenticatedRequest): Promise<import("./consent.entity").DataConsent>;
    exportLeadData(id: string, req: AuthenticatedRequest): Promise<Record<string, unknown>>;
    anonymizeLead(id: string, req: AuthenticatedRequest): Promise<import("../../modules/crm/leads/lead.entity").Lead>;
    anonymizeContact(id: string, req: AuthenticatedRequest): Promise<import("../../modules/crm/contacts/contact.entity").Contact>;
    anonymizeReservation(id: string, req: AuthenticatedRequest): Promise<import("../../modules/reservations/domain/reservation.entity").Reservation>;
}
