export declare class CreateReservationFormDto {
    clientId: string;
    name: string;
    publicSlug?: string;
    mode?: string;
}
export declare class UpdateReservationFormDto {
    name?: string;
    status?: string;
    timezone?: string;
    durationMinutes?: number;
    bufferMinutes?: number;
    capacityPerSlot?: number;
    dailyCapacity?: number;
    maximumAdvanceDays?: number;
    minimumNoticeHours?: number;
    confirmationMode?: string;
    fieldSchema?: unknown[];
    designConfig?: Record<string, unknown>;
    scheduleConfig?: Record<string, unknown>;
    servicesConfig?: unknown[];
    resourcesConfig?: unknown[];
    campaignId?: string;
    crmEnabled?: boolean;
    calendarEnabled?: boolean;
    metaCapiEnabled?: boolean;
    ga4MeasurementId?: string;
    teamNotifications?: string[];
}
export declare class CreateBlockDto {
    startsAt: string;
    endsAt: string;
    reason?: string;
}
export declare class CouponValidateDto {
    code: string;
    startsAt?: string;
}
export declare class PublicReservationDto {
    startsAt: string;
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    partySize?: number;
    serviceId?: string;
    resourceId?: string;
    answers: Record<string, unknown>;
    idempotencyKey: string;
    consentVersion?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    clickId?: string;
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
    fbclid?: string;
    fbc?: string;
    fbp?: string;
    eventSourceUrl?: string;
    website?: string;
    renderedAt?: string;
    couponCode?: string;
}
export declare class UpdateReservationDto {
    status?: string;
    internalNotes?: string;
    startsAt?: string;
}
export declare class PublicFormEventDto {
    type: string;
    sessionId?: string;
    utmSource?: string;
    utmCampaign?: string;
}
export declare class PublicSurveyResponseDto {
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    answers: Record<string, unknown>;
    idempotencyKey: string;
    utmSource?: string;
    utmCampaign?: string;
    clickId?: string;
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
    fbclid?: string;
    fbc?: string;
    fbp?: string;
    eventSourceUrl?: string;
    website?: string;
}
export declare class CreateCouponDto {
    code: string;
    discountType?: string;
    value?: number;
    maxUses?: number;
    validFrom?: string;
    validUntil?: string;
    formIds?: string[];
    validDaysOfWeek?: number[];
    validFromTime?: string;
    validUntilTime?: string;
}
export declare class CreateManualReservationDto {
    formId: string;
    startsAt: string;
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    partySize?: number;
    serviceId?: string;
    resourceId?: string;
    answers?: Record<string, unknown>;
    skipAvailability?: boolean;
    internalNotes?: string;
}
export declare class ImportReservationsDto {
    formId: string;
    csvContent: string;
    dryRun?: boolean;
    skipAvailability?: boolean;
}
export declare class ListReservationsDto {
    page?: number;
    pageSize?: number;
    formId?: string;
    status?: string;
    from?: string;
    to?: string;
    search?: string;
    clientId?: string;
    couponCode?: string;
}
export declare class UpdateCouponDto {
    active?: boolean;
    value?: number;
    maxUses?: number;
    validFrom?: string;
    validUntil?: string;
    formIds?: string[];
    validDaysOfWeek?: number[];
    validFromTime?: string;
    validUntilTime?: string;
}
export declare class ExportFormReservationsDto {
    format: 'csv' | 'json';
    dateFrom?: string;
    dateTo?: string;
    fields: string[];
}
export declare class ReservationScopeDto {
    clientId?: string;
    from?: string;
    to?: string;
    limit?: number;
    days?: number;
}
