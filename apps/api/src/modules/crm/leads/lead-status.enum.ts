import type { LeadStatus as SharedLeadStatus } from '@espartanos/shared';

/**
 * Estados de un lead.
 *
 * `class-validator` necesita un enum de TypeScript para `@IsEnum`, por lo que los valores se
 * declaran aquí y la verificación de más abajo garantiza que coincidan con el catálogo
 * compartido en ambas direcciones.
 */
export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  MEETING_SCHEDULED = 'meeting_scheduled',
  QUOTE_SENT = 'quote_sent',
  VISITED = 'visited',
  NEGOTIATION = 'negotiation',
  // Resultados del ciclo de reserva: los escribe el flujo de reservas, no el equipo.
  RESERVED = 'reserved',
  ATTENDED = 'attended',
  NO_SHOW = 'no_show',
  WON = 'won',
  LOST = 'lost',
}

/**
 * Verificación mutua contra `@espartanos/shared`.
 *
 * Falla la compilación si el enum y el catálogo compartido dejan de contener exactamente los
 * mismos valores. La comprobación es en ambos sentidos a propósito: un subconjunto satisface
 * al tipo, de modo que una sola dirección no detectaría un valor faltante.
 */
type EnumMatchesShared = `${LeadStatus}` extends SharedLeadStatus
  ? SharedLeadStatus extends `${LeadStatus}` ? true : never
  : never;
const _leadStatusMatchesShared: EnumMatchesShared = true;
void _leadStatusMatchesShared;

/**
 * Dominio al que pertenece cada estado.
 *
 * El enumerado es uno solo porque la columna es una sola, pero **los estados no son
 * intercambiables entre dominios**: el embudo comercial describe una venta de la agencia y el
 * ciclo de reserva describe la visita de un comensal al local de un cliente. Antes cualquier
 * valor del enumerado se aceptaba para cualquier lead, así que por API se podía marcar a un
 * comensal como `negotiation` y meterlo en el pronóstico comercial.
 *
 * `new` y `lost` están en los dos a propósito: todo lead nace nuevo, y una reserva que no llegó
 * a concretarse se cierra igual que una venta que no se ganó.
 */
export const STATUSES_BY_DOMAIN: Record<'commercial' | 'audience', readonly LeadStatus[]> = {
  commercial: [
    LeadStatus.NEW,
    LeadStatus.CONTACTED,
    LeadStatus.QUOTE_SENT,
    LeadStatus.MEETING_SCHEDULED,
    LeadStatus.VISITED,
    LeadStatus.NEGOTIATION,
    LeadStatus.WON,
    LeadStatus.LOST,
  ],
  audience: [
    LeadStatus.NEW,
    LeadStatus.RESERVED,
    LeadStatus.ATTENDED,
    LeadStatus.NO_SHOW,
    LeadStatus.LOST,
  ],
};

/**
 * Indica si un estado corresponde al dominio de un lead.
 *
 * Un dominio desconocido no habilita nada: es preferible rechazar un lead con el dominio mal
 * escrito a dejar pasar cualquier estado sobre él.
 *
 * @param domain - Dominio del lead, tal como está persistido.
 * @param status - Estado al que se quiere mover.
 */
export function isStatusInDomain(domain: string | undefined, status: LeadStatus): boolean {
  const allowed = STATUSES_BY_DOMAIN[domain as keyof typeof STATUSES_BY_DOMAIN];
  return Boolean(allowed?.includes(status));
}
