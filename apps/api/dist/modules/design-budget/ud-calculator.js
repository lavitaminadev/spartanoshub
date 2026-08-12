"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAROUSEL_EXTRA_PER_SLIDE = exports.CAROUSEL_BASE_UD = exports.UD_MATRIX = void 0;
exports.calculatePieceUd = calculatePieceUd;
const piece_type_enum_1 = require("../production/piece-type.enum");
exports.UD_MATRIX = {
    [piece_type_enum_1.PieceType.POST_SIMPLE]: 1.0,
    [piece_type_enum_1.PieceType.POST_AUTHOR]: 1.5,
    [piece_type_enum_1.PieceType.STORY_ORIGINAL]: 0.4,
    [piece_type_enum_1.PieceType.STORY_ADAPTED]: 0.1,
    [piece_type_enum_1.PieceType.STORY_TEMPLATE]: 0.2,
    [piece_type_enum_1.PieceType.REEL_COVER]: 0.3,
    [piece_type_enum_1.PieceType.FLYER_DIGITAL]: 1.5,
    [piece_type_enum_1.PieceType.FLYER_PRINT]: 2.0,
};
exports.CAROUSEL_BASE_UD = 1.0;
exports.CAROUSEL_EXTRA_PER_SLIDE = 0.4;
function calculatePieceUd(pieceType, carouselSlides = 0) {
    if (pieceType === piece_type_enum_1.PieceType.CAROUSEL) {
        return exports.CAROUSEL_BASE_UD + Math.max(0, carouselSlides - 1) * exports.CAROUSEL_EXTRA_PER_SLIDE;
    }
    return exports.UD_MATRIX[pieceType] ?? 1.0;
}
