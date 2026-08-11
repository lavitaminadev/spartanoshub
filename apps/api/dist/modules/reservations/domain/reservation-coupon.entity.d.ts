export declare class ReservationCoupon {
    id: string;
    organizationId: string;
    clientId?: string;
    code: string;
    discountType: string;
    value: number;
    maxUses: number;
    usageCount: number;
    validFrom?: Date;
    validUntil?: Date;
    formIds?: string[];
    validDaysOfWeek?: number[];
    validFromTime?: string;
    validUntilTime?: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
