import { ReservationsService } from './application/reservations.service';
import { CouponValidateDto, PublicFormEventDto, PublicReservationDto, PublicSurveyResponseDto } from './dto/reservation.dto';
export declare class PublicReservationsController {
    private service;
    constructor(service: ReservationsService);
    private eventSourceUrl;
    form(slug: string): Promise<{
        name: string;
        publicSlug: string;
        mode: string;
        timezone: string;
        durationMinutes: number;
        capacityPerSlot: number;
        confirmationMode: string;
        fieldSchema: {
            id: string;
            type: string;
            label: string;
            required?: boolean;
            internal?: boolean;
            options?: string[];
        }[];
        designConfig: Record<string, unknown>;
        servicesConfig: unknown[] | undefined;
        resourcesConfig: unknown[] | undefined;
        pixelId: string;
        pixelName: string | null;
        metaReady: boolean;
        ga4MeasurementId: string | null;
    }>;
    slots(slug: string, from: string, days?: string, serviceId?: string, resourceId?: string): Promise<{
        slots: {
            startsAt: string;
            available: number;
        }[];
        fullDays: string[];
    }>;
    event(slug: string, dto: PublicFormEventDto): Promise<import("./domain/reservation-form-event.entity").ReservationFormEvent>;
    validateCoupon(slug: string, dto: CouponValidateDto): Promise<{
        valid: boolean;
        discountType: string;
        value: number;
    }>;
    survey(slug: string, dto: PublicSurveyResponseDto, ipAddress: string, userAgent: string | undefined): Promise<import("./domain/reservation-form-event.entity").ReservationFormEvent>;
    create(slug: string, dto: PublicReservationDto, ipAddress: string, userAgent: string | undefined): Promise<import("./domain/reservation.entity").Reservation>;
}
