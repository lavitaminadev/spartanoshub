import { PieceType } from '../production/piece-type.enum';

export const UD_MATRIX: Record<string, number> = {
  [PieceType.POST_SIMPLE]: 1.0,
  [PieceType.POST_AUTHOR]: 1.5,
  [PieceType.STORY_ORIGINAL]: 0.4,
  [PieceType.STORY_ADAPTED]: 0.1,
  [PieceType.STORY_TEMPLATE]: 0.2,
  [PieceType.REEL_COVER]: 0.3,
  [PieceType.FLYER_DIGITAL]: 1.5,
  [PieceType.FLYER_PRINT]: 2.0,
};

export const CAROUSEL_BASE_UD = 1.0;
export const CAROUSEL_EXTRA_PER_SLIDE = 0.4;

/**
 * Unidades que consume una pieza, o `0` si su tipo todavía no tiene valor asignado.
 *
 * La matriz del Documento Maestro 6.1 cubre nueve tipos. La Dirección de Arte enumeró trece más
 * que también produce —logotipos, gigantografías, brochures, presentaciones— y para esos no hay
 * valor definido: es una decisión económica que le corresponde a Dirección.
 *
 * Antes se devolvía `1.0` para cualquier tipo desconocido. Eso cobraba al presupuesto del
 * cliente lo mismo por un logotipo que por un post simple, con una cifra que nadie decidió y sin
 * dejar rastro de que era supuesta.
 *
 * Devolver cero es visible: el saldo no se mueve, la pieza queda registrada, y `necesitaValor`
 * permite listarlas para que alguien las valore. Un cero evidente se corrige; un uno inventado
 * se factura.
 */
export function calculatePieceUd(pieceType: string, carouselSlides = 0): number {
  if (pieceType === PieceType.CAROUSEL) {
    return CAROUSEL_BASE_UD + Math.max(0, carouselSlides - 1) * CAROUSEL_EXTRA_PER_SLIDE;
  }
  return UD_MATRIX[pieceType] ?? 0;
}

/** Si el tipo de pieza todavía espera que Dirección le asigne un valor en unidades. */
export function necesitaValorUd(pieceType: string): boolean {
  return pieceType !== PieceType.CAROUSEL && UD_MATRIX[pieceType] === undefined;
}

/** Tipos que ya se pueden cobrar contra el presupuesto, para separarlos de los pendientes. */
export function tiposConValorUd(): string[] {
  return [PieceType.CAROUSEL, ...Object.keys(UD_MATRIX)];
}
