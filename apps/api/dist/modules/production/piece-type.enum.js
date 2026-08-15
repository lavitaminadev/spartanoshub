"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRINT_PIECE_TYPES = exports.PIECE_TYPE_LABELS = exports.PieceType = void 0;
var PieceType;
(function (PieceType) {
    PieceType["POST_SIMPLE"] = "post_simple";
    PieceType["POST_AUTHOR"] = "post_author";
    PieceType["CAROUSEL"] = "carousel";
    PieceType["STORY_ORIGINAL"] = "story_original";
    PieceType["STORY_ADAPTED"] = "story_adapted";
    PieceType["STORY_TEMPLATE"] = "story_template";
    PieceType["REEL_COVER"] = "reel_cover";
    PieceType["FLYER_DIGITAL"] = "flyer_digital";
    PieceType["FLYER_PRINT"] = "flyer_print";
    PieceType["HIGHLIGHT_COVER"] = "highlight_cover";
    PieceType["PALOMA"] = "paloma";
    PieceType["POSTER"] = "poster";
    PieceType["TABLETENT"] = "tabletent";
    PieceType["BUSINESS_CARD"] = "business_card";
    PieceType["BANNER_PRINT"] = "banner_print";
    PieceType["BILLBOARD"] = "billboard";
    PieceType["PRESENTATION"] = "presentation";
    PieceType["BROCHURE"] = "brochure";
    PieceType["BRAND_MANUAL"] = "brand_manual";
    PieceType["LOGO"] = "logo";
    PieceType["MAILING"] = "mailing";
    PieceType["BANNER_DIGITAL"] = "banner_digital";
    PieceType["LETTER"] = "letter";
})(PieceType || (exports.PieceType = PieceType = {}));
exports.PIECE_TYPE_LABELS = {
    [PieceType.POST_SIMPLE]: 'Post estático simple',
    [PieceType.POST_AUTHOR]: 'Post estático de autor',
    [PieceType.CAROUSEL]: 'Carrusel',
    [PieceType.STORY_ORIGINAL]: 'Historia original',
    [PieceType.STORY_ADAPTED]: 'Historia adaptada o reposteo',
    [PieceType.STORY_TEMPLATE]: 'Historia de plantilla recurrente',
    [PieceType.REEL_COVER]: 'Portada de reel',
    [PieceType.FLYER_DIGITAL]: 'Flyer digital',
    [PieceType.FLYER_PRINT]: 'Flyer o pendón para imprenta',
    [PieceType.HIGHLIGHT_COVER]: 'Portada destacada',
    [PieceType.PALOMA]: 'Paloma',
    [PieceType.POSTER]: 'Cartel',
    [PieceType.TABLETENT]: 'Tabletent',
    [PieceType.BUSINESS_CARD]: 'Tarjeta de presentación',
    [PieceType.BANNER_PRINT]: 'Pendón',
    [PieceType.BILLBOARD]: 'Gigantografía',
    [PieceType.PRESENTATION]: 'Presentación',
    [PieceType.BROCHURE]: 'Brochure',
    [PieceType.BRAND_MANUAL]: 'Manual de marca',
    [PieceType.LOGO]: 'Logotipo',
    [PieceType.MAILING]: 'Mailing',
    [PieceType.BANNER_DIGITAL]: 'Banner digital',
    [PieceType.LETTER]: 'Carta',
};
exports.PRINT_PIECE_TYPES = [
    PieceType.FLYER_PRINT,
    PieceType.PALOMA,
    PieceType.POSTER,
    PieceType.TABLETENT,
    PieceType.BUSINESS_CARD,
    PieceType.BANNER_PRINT,
    PieceType.BILLBOARD,
];
