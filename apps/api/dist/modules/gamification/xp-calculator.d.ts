import { XpTier } from './xp-tier.enum';
export declare const BASE_XP: Record<number, number>;
export declare const EXPECTED_HOURS: Record<number, number>;
export interface DeliveryXpParams {
    difficultyLevel: number;
    actualHours: number;
    expectedHours?: number;
    perfectNaming: boolean;
    hadDesignerErrorCorrection: boolean;
    delayJustification?: string | null;
}
export declare function calculateBase(level: number): number;
export declare function calculateDeliveryXp(params: DeliveryXpParams): number;
export declare function calculateWeeklyTier(totalXp: number): XpTier | null;
