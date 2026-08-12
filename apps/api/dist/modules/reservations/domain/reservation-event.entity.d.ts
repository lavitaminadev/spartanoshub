export declare class ReservationEvent {
    id: string;
    organizationId: string;
    clientId: string;
    reservationId: string;
    type: string;
    fromStatus?: string;
    toStatus?: string;
    actorId?: string;
    actorType: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}
