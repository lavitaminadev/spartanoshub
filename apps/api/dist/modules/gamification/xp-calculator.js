"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPECTED_HOURS = exports.BASE_XP = void 0;
exports.calculateBase = calculateBase;
exports.calculateDeliveryXp = calculateDeliveryXp;
exports.calculateWeeklyTier = calculateWeeklyTier;
const xp_tier_enum_1 = require("./xp-tier.enum");
exports.BASE_XP = {
    1: 5, 2: 10, 3: 20, 4: 40, 5: 80,
};
exports.EXPECTED_HOURS = {
    1: 0.75, 2: 1.5, 3: 3, 4: 5, 5: 8,
};
function calculateBase(level) {
    return exports.BASE_XP[level] ?? 0;
}
function calculateDeliveryXp(params) {
    const base = calculateBase(params.difficultyLevel);
    let xp = base;
    const expected = params.expectedHours ?? exports.EXPECTED_HOURS[params.difficultyLevel] ?? 3;
    if (expected > 0) {
        const ratio = params.actualHours / expected;
        if (ratio <= 0.5)
            xp += Math.round(base * 0.5);
        else if (ratio <= 0.75)
            xp += Math.round(base * 0.25);
    }
    if (params.perfectNaming)
        xp += 2;
    if (params.actualHours > expected) {
        const overdue = params.actualHours - expected;
        if (overdue <= 2)
            xp = Math.round(xp * 0.8);
        else if (params.delayJustification)
            xp = Math.round(xp * 0.5);
        else
            xp = Math.round(xp * 0.25);
    }
    if (params.hadDesignerErrorCorrection)
        xp -= 5;
    return Math.max(0, xp);
}
function calculateWeeklyTier(totalXp) {
    if (totalXp >= xp_tier_enum_1.XP_TIER_THRESHOLDS[xp_tier_enum_1.XpTier.DIAMOND])
        return xp_tier_enum_1.XpTier.DIAMOND;
    if (totalXp >= xp_tier_enum_1.XP_TIER_THRESHOLDS[xp_tier_enum_1.XpTier.PLATINUM])
        return xp_tier_enum_1.XpTier.PLATINUM;
    if (totalXp >= xp_tier_enum_1.XP_TIER_THRESHOLDS[xp_tier_enum_1.XpTier.GOLD])
        return xp_tier_enum_1.XpTier.GOLD;
    if (totalXp >= xp_tier_enum_1.XP_TIER_THRESHOLDS[xp_tier_enum_1.XpTier.SILVER])
        return xp_tier_enum_1.XpTier.SILVER;
    if (totalXp >= xp_tier_enum_1.XP_TIER_THRESHOLDS[xp_tier_enum_1.XpTier.BRONZE])
        return xp_tier_enum_1.XpTier.BRONZE;
    return null;
}
//# sourceMappingURL=xp-calculator.js.map