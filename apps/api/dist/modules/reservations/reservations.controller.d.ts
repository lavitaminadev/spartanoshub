import type { AuthenticatedRequest } from '@shared/types/request';
import type { Response } from 'express';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { AuditService } from '../../core/audit/audit.service';
import { ReservationsService } from './application/reservations.service';
import { ReservationsBulkImportService } from './application/bulk-import.service';
import { CreateBlockDto, CreateCouponDto, CreateManualReservationDto, CreateReservationFormDto, ExportFormReservationsDto, ImportReservationsDto, ListReservationsDto, ReservationScopeDto, UpdateCouponDto, UpdateReservationDto, UpdateReservationFormDto } from './dto/reservation.dto';
export declare class ReservationsController {
    private readonly service;
    private readonly accountAccess;
    private readonly bulkImport;
    private readonly audit;
    constructor(service: ReservationsService, accountAccess: AccountAccessService, bulkImport: ReservationsBulkImportService, audit: AuditService);
    private publicOrigin;
    private decorateForm;
    private client;
    private scope;
    private requestedScope;
    forms(req: AuthenticatedRequest, query: ReservationScopeDto): Promise<{
        publicUrl: string | undefined;
        id: string;
        organizationId: string;
        clientId: string;
        name: string;
        publicSlug: string;
        status: string;
        mode: string;
        timezone: string;
        durationMinutes: number;
        bufferMinutes: number;
        capacityPerSlot: number;
        dailyCapacity: number;
        minimumNoticeHours: number;
        maximumAdvanceDays: number;
        confirmationMode: string;
        fieldSchema: unknown[];
        designConfig: Record<string, unknown>;
        scheduleConfig: Record<string, unknown>;
        servicesConfig?: unknown[];
        resourcesConfig?: unknown[];
        campaignId?: string;
        crmEnabled: boolean;
        calendarEnabled: boolean;
        metaCapiEnabled: boolean;
        ga4MeasurementId?: string | null;
        teamNotifications?: string[];
        createdBy: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    create(req: AuthenticatedRequest, dto: CreateReservationFormDto): Promise<any>;
    form(req: AuthenticatedRequest, id: string): Promise<any>;
    update(req: AuthenticatedRequest, id: string, dto: UpdateReservationFormDto): Promise<any>;
    duplicate(req: AuthenticatedRequest, id: string): Promise<any>;
    blocks(req: AuthenticatedRequest, id: string): Promise<import("./domain/availability-block.entity").AvailabilityBlock[]>;
    block(req: AuthenticatedRequest, id: string, dto: CreateBlockDto): Promise<import("./domain/availability-block.entity").AvailabilityBlock>;
    batchBlock(req: AuthenticatedRequest, id: string, dtos: CreateBlockDto[]): Promise<{
        created: number;
        total: number;
        errors: string[] | undefined;
    }>;
    deleteBlock(req: AuthenticatedRequest, id: string): Promise<{
        deleted: boolean;
    }>;
    createManual(req: AuthenticatedRequest, dto: CreateManualReservationDto): Promise<import("./domain/reservation.entity").Reservation>;
    importReservations(req: AuthenticatedRequest, dto: ImportReservationsDto): Promise<import("./application/bulk-import.service").ImportPreview | import("./application/bulk-import.service").ImportResult>;
    list(req: AuthenticatedRequest, query: ListReservationsDto): Promise<{
        items: {
            metaConversion: {
                schedule: string | null;
                attended: string | null;
                matchFields: number;
            } | undefined;
            id: string;
            organizationId: string;
            clientId: string;
            formId: string;
            contactId?: string | null;
            referenceCode: string;
            idempotencyKey?: string;
            status: string;
            startsAt: Date;
            endsAt: Date;
            partySize: number;
            serviceId?: string;
            resourceId?: string;
            guestName: string;
            guestEmail?: string | null;
            guestPhone?: string | null;
            answers: Record<string, unknown>;
            consentVersion?: string;
            utmSource?: string;
            utmMedium?: string;
            utmCampaign?: string;
            utmContent?: string;
            clickId?: string;
            gclid?: string | null;
            gbraid?: string | null;
            wbraid?: string | null;
            fbclid?: string | null;
            fbc?: string | null;
            fbp?: string | null;
            clientIpAddress?: string | null;
            clientUserAgent?: string | null;
            calendarEventId?: string;
            calendarUrl?: string;
            couponCode?: string;
            createdAt: Date;
            updatedAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
        pages: number;
    }>;
    updateReservation(req: AuthenticatedRequest, id: string, dto: UpdateReservationDto): Promise<import("./domain/reservation.entity").Reservation>;
    history(req: AuthenticatedRequest, id: string): Promise<import("./domain/reservation-event.entity").ReservationEvent[]>;
    listCoupons(req: AuthenticatedRequest): Promise<import("./domain/reservation-coupon.entity").ReservationCoupon[]>;
    createCoupon(req: AuthenticatedRequest, dto: CreateCouponDto): Promise<import("./domain/reservation-coupon.entity").ReservationCoupon>;
    updateCoupon(req: AuthenticatedRequest, id: string, dto: UpdateCouponDto): Promise<import("./domain/reservation-coupon.entity").ReservationCoupon>;
    exportCsv(req: AuthenticatedRequest, query: ReservationScopeDto, res: Response): Promise<void>;
    exportForm(req: AuthenticatedRequest, formId: string, body: ExportFormReservationsDto, res: Response): Promise<void>;
    operationalHome(req: AuthenticatedRequest, query: ReservationScopeDto): Promise<{
        date: string;
        timezone: string;
        today: {
            total: number;
            attended: number;
            pending: number;
            noShow: number;
            dailyCap: number;
            occupancyPct: number | null;
        };
        upcoming: {
            id: string;
            startsAt: string;
            guestName: string;
            partySize: number;
            status: string;
            metaConversion: {
                schedule: string | null;
                attended: string | null;
                matchFields: number;
            } | null;
        }[];
    }>;
    metrics(req: AuthenticatedRequest, query: ReservationScopeDto): Promise<{
        totals: any;
        daily: any;
        sources: any;
        areas: any;
        funnel: {
            views: number;
            starts: number;
            completed: number;
            conversionRate: number | null;
        };
        days: number;
    }>;
    occupancy(req: AuthenticatedRequest, month: string, query: ReservationScopeDto): Promise<{
        month: string;
        capacity: number;
        days: {
            date: string;
            count: number;
            pct: number | null;
        }[];
    }>;
}
