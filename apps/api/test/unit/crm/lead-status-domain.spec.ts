import { describe, expect, it } from 'vitest';
import { LEAD_PIPELINE_STAGES, LEAD_CLOSING_STAGES, LEAD_RESERVATION_OUTCOMES } from '@espartanos/shared';
import { LeadStatus, STATUSES_BY_DOMAIN, isStatusInDomain } from '../../../src/modules/crm/leads/lead-status.enum';

/**
 * El reparto por dominio contra el catálogo compartido.
 *
 * `STATUSES_BY_DOMAIN` decide qué movimientos acepta el servidor, y las columnas del tablero se
 * arman del catálogo compartido. Si se separan, se rompe por los dos lados: un estado que la
 * pantalla ofrece y la API rechaza da un 400 al arrastrar, y uno que la API acepta y la pantalla
 * no dibuja deja al lead sin columna donde aparecer.
 */
describe('estados por dominio', () => {
  it('el comercial es el pipeline compartido más los dos cierres', () => {
    expect(STATUSES_BY_DOMAIN.commercial.map(String))
      .toEqual([...LEAD_PIPELINE_STAGES, ...LEAD_CLOSING_STAGES]);
  });

  it('el de audiencia son los resultados de reserva, más el ingreso y el descarte', () => {
    expect(STATUSES_BY_DOMAIN.audience.map(String))
      .toEqual(['new', ...LEAD_RESERVATION_OUTCOMES, 'lost']);
  });

  it('«visitó» es comercial y no se puede aplicar a un contacto de campaña', () => {
    expect(isStatusInDomain('commercial', LeadStatus.VISITED)).toBe(true);
    expect(isStatusInDomain('audience', LeadStatus.VISITED)).toBe(false);
  });

  it('todo estado del enumerado pertenece a algún dominio, o sería inalcanzable', () => {
    const repartidos = new Set([...STATUSES_BY_DOMAIN.commercial, ...STATUSES_BY_DOMAIN.audience]);
    for (const estado of Object.values(LeadStatus)) {
      expect(repartidos.has(estado), estado).toBe(true);
    }
  });
});
