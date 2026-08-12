"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XP_TIER_THRESHOLDS = exports.XpTier = void 0;
var XpTier;
(function (XpTier) {
    XpTier["BRONZE"] = "bronze";
    XpTier["SILVER"] = "silver";
    XpTier["GOLD"] = "gold";
    XpTier["PLATINUM"] = "platinum";
    XpTier["DIAMOND"] = "diamond";
})(XpTier || (exports.XpTier = XpTier = {}));
exports.XP_TIER_THRESHOLDS = {
    [XpTier.BRONZE]: 30,
    [XpTier.SILVER]: 60,
    [XpTier.GOLD]: 100,
    [XpTier.PLATINUM]: 150,
    [XpTier.DIAMOND]: 200,
};
