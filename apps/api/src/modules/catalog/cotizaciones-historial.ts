import { QuoteStatus } from './quote-status.enum';

/** Lo mínimo de una cotización que hace falta para ordenar versiones y resumir un historial. */
export interface CotizacionDelHistorial {
  id: string;
  number: string;
  version: number;
  parentQuoteId?: string | null;
  status: QuoteStatus | string;
  sentAt?: Date | null;
  acceptedAt?: Date | null;
  createdAt: Date;
  amount: number | string;
  currency: string;
}

/** Una versión tal como se muestra en el árbol de una cotización. */
export interface VersionDeCotizacion {
  id: string;
  number: string;
  version: number;
  status: string;
  amount: number;
  currency: string;
  sentAt: Date | null;
  acceptedAt: Date | null;
  createdAt: Date;
  /** La versión por la que se consultó, para resaltarla en la ficha. */
  actual: boolean;
}

/** Cuántas veces se cotizó a un prospecto y cuándo fue la última. */
export interface ResumenDeCotizacionesDelLead {
  veces: number;
  ultimaEn: Date | null;
}

/**
 * Identificador de la familia de versiones a la que pertenece una cotización.
 *
 * Toda versión nueva apunta a la cotización original, así que la familia es la raíz y sus hijas;
 * una cotización sin padre es su propia raíz.
 */
export function raizDeLaFamilia(cotizacion: Pick<CotizacionDelHistorial, 'id' | 'parentQuoteId'>): string {
  return cotizacion.parentQuoteId ?? cotizacion.id;
}

/**
 * Ordena las versiones de una familia de la primera a la última.
 *
 * Desempata por fecha de creación para que dos filas con el mismo número de versión salgan
 * siempre en el mismo orden. Una familia de una sola versión devuelve esa versión sola; una lista
 * vacía devuelve una lista vacía.
 */
export function arbolDeVersiones(familia: CotizacionDelHistorial[], consultadaId?: string): VersionDeCotizacion[] {
  return [...familia]
    .sort((a, b) => Number(a.version) - Number(b.version) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((c) => ({
      id: c.id,
      number: c.number,
      version: Number(c.version),
      status: String(c.status),
      amount: Number(c.amount),
      currency: c.currency,
      sentAt: c.sentAt ?? null,
      acceptedAt: c.acceptedAt ?? null,
      createdAt: c.createdAt,
      actual: c.id === consultadaId,
    }));
}

/**
 * Resume cuántas veces se cotizó a un prospecto y cuándo fue la última.
 *
 * Cuenta **cotizaciones**, no versiones: reenviar la v2 de una propuesta no es cotizar otra vez.
 * Sólo cuenta las que salieron —enviadas o aceptadas—; un borrador que nadie vio no es haber
 * cotizado. Sin ninguna, devuelve `veces: 0` y `ultimaEn: null`, y quien muestra el dato debe
 * omitirlo en lugar de escribir «0 veces».
 */
export function resumenDeCotizaciones(cotizaciones: CotizacionDelHistorial[]): ResumenDeCotizacionesDelLead {
  const familias = new Set<string>();
  let ultima: Date | null = null;
  for (const c of cotizaciones) {
    const salio = c.sentAt ?? c.acceptedAt ?? null;
    if (!salio) continue;
    familias.add(raizDeLaFamilia(c));
    const fecha = new Date(salio);
    if (!ultima || fecha.getTime() > ultima.getTime()) ultima = fecha;
  }
  return { veces: familias.size, ultimaEn: ultima };
}

/**
 * Convierte lo que escribe la persona en el patrón de un `LIKE` sobre el nombre de la empresa.
 *
 * Quita los comodines (`%`, `_`, `\`) para que se busquen como texto y no como patrón, y
 * recorta los espacios. La insensibilidad a mayúsculas y acentos **no** se resuelve aquí: la
 * consulta compara con una colación `_ci` explícita (ver `QuotesService`), que es la que la
 * garantiza en la base. Devuelve `undefined` si no queda nada que buscar.
 */
export function patronDeBusqueda(texto?: string): string | undefined {
  const limpio = (texto ?? '').replace(/[%_\\]/g, ' ').replace(/\s+/g, ' ').trim();
  return limpio ? `%${limpio}%` : undefined;
}
