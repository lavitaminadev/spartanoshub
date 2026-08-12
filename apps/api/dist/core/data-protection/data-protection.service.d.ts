import { Repository } from 'typeorm';
import { User } from '../../modules/users/user.entity';
import { AuditLog } from '../audit/audit.entity';
import { DataConsent } from './consent.entity';
import { Lead } from '../../modules/crm/leads/lead.entity';
import { Contact } from '../../modules/crm/contacts/contact.entity';
import { Reservation } from '../../modules/reservations/domain/reservation.entity';
export declare class DataProtectionService {
    private userRepo;
    private leadRepo;
    private auditRepo;
    private consentRepo;
    private contactRepo;
    private reservationRepo;
    constructor(userRepo: Repository<User>, leadRepo: Repository<Lead>, auditRepo: Repository<AuditLog>, consentRepo: Repository<DataConsent>, contactRepo: Repository<Contact>, reservationRepo: Repository<Reservation>);
    private recordAnonymization;
    anonymizeUser(userId: string): Promise<void>;
    exportUserData(userId: string): Promise<Record<string, unknown>>;
    deleteUserData(userId: string): Promise<void>;
    exportLeadData(leadId: string, organizationId: string): Promise<Record<string, unknown>>;
    anonymizeLead(leadId: string, organizationId: string, reason?: string): Promise<Lead>;
    anonymizeContact(contactId: string, organizationId: string, reason?: string): Promise<Contact>;
    anonymizeReservation(reservationId: string, organizationId: string, reason?: string): Promise<Reservation>;
    anonymizeExpiredReservations(retentionDays: number, reason?: string): Promise<{
        reviewed: number;
        anonymized: number;
    }>;
    recordConsent(userId: string, action: string, granted: boolean, ipAddress?: string): Promise<DataConsent>;
}
