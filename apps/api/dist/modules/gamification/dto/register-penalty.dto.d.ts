import { XPEventType } from '../xp-event-type.enum';
export declare class RegisterPenaltyDto {
    userId: string;
    pieceId: string;
    points: number;
    eventType: XPEventType;
}
