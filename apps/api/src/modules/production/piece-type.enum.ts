/**
 * Tipos de pieza que produce Arte.
 *
 * Los nueve primeros vienen de la matriz de unidades del Documento Maestro 6.1 y tienen valor
 * asignado. Los demás los enumeró la Dirección de Arte al describir su operación real, y **no
 * tienen valor todavía**: el Documento Maestro no los cubre.
 *
 * Se listan igual, en vez de dejarlos fuera, porque no poder registrar un logotipo no hace que
 * deje de producirse: solo hace que se registre como otra cosa. Mientras no tengan valor, el
 * cálculo devuelve cero y la pieza queda marcada para valorar, que es visible y corregible.
 * Cobrarle al cliente una cifra inventada no lo es.
 */
export enum PieceType {
  // --- Con valor definido en el Documento Maestro 6.1 ---
  POST_SIMPLE = 'post_simple',
  POST_AUTHOR = 'post_author',
  CAROUSEL = 'carousel',
  STORY_ORIGINAL = 'story_original',
  STORY_ADAPTED = 'story_adapted',
  STORY_TEMPLATE = 'story_template',
  REEL_COVER = 'reel_cover',
  FLYER_DIGITAL = 'flyer_digital',
  FLYER_PRINT = 'flyer_print',

  // --- Enumerados por Dirección de Arte, pendientes de valorar ---
  // Redes sociales
  HIGHLIGHT_COVER = 'highlight_cover',
  // Impresión
  PALOMA = 'paloma',
  POSTER = 'poster',
  TABLETENT = 'tabletent',
  BUSINESS_CARD = 'business_card',
  BANNER_PRINT = 'banner_print',
  BILLBOARD = 'billboard',
  // Otros
  PRESENTATION = 'presentation',
  BROCHURE = 'brochure',
  BRAND_MANUAL = 'brand_manual',
  LOGO = 'logo',
  MAILING = 'mailing',
  BANNER_DIGITAL = 'banner_digital',
  LETTER = 'letter',
}

/** Nombre en español de cada tipo, para formularios y tableros. */
export const PIECE_TYPE_LABELS: Record<PieceType, string> = {
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

/**
 * Destino de la pieza, que es como Arte gradúa hoy el esfuerzo.
 *
 * La Dirección de Arte clasifica en dos: impresión es complejidad alta, redes sociales normal.
 * No usa la escala de cinco niveles del Documento Maestro. Se registra el destino porque es el
 * dato que el área sí produce; la escala fina queda pendiente de que ambas partes la concilien.
 */
export const PRINT_PIECE_TYPES: readonly PieceType[] = [
  PieceType.FLYER_PRINT,
  PieceType.PALOMA,
  PieceType.POSTER,
  PieceType.TABLETENT,
  PieceType.BUSINESS_CARD,
  PieceType.BANNER_PRINT,
  PieceType.BILLBOARD,
];
