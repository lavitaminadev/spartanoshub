import { describe, expect, it } from 'vitest';
import { LEAD_PIPELINE_STAGES, LEAD_CLOSING_STAGES, LEAD_RESERVATION_OUTCOMES } from '@espartanos/shared';
import { STAGES, STAGE_LABEL, STAGE_ACCENT } from './stage-labels';
import { CONTACT_STATUS_OPTIONS } from '../../shared/status-palette';

/**
 * Las columnas del tablero contra los estados que acepta el servidor.
 *
 * Un estado válido en la API pero ausente de la pantalla deja al lead sin columna donde
 * aparecer: no se borra, se vuelve invisible. Pasó con «Descartado» en el embudo de clientes y
 * con «Visitó» en el comercial, y en ningún caso falló nada —ni al compilar ni al probar—,
 * porque el fallo está en lo que la lista no dice.
 */
describe('catálogo de etapas · la pantalla ofrece lo que el servidor acepta', () => {
  it('el embudo comercial son las etapas del pipeline más los dos cierres', () => {
    expect([...STAGES]).toEqual([...LEAD_PIPELINE_STAGES, ...LEAD_CLOSING_STAGES]);
  });

  it('cada etapa comercial tiene rótulo y color, o la columna sale en blanco', () => {
    for (const etapa of STAGES) {
      expect(STAGE_LABEL[etapa], etapa).toBeTruthy();
      expect(STAGE_ACCENT[etapa], etapa).toBeTruthy();
    }
  });

  it('el embudo de clientes son los resultados de reserva, más el ingreso y el descarte', () => {
    expect(CONTACT_STATUS_OPTIONS.map((opcion) => opcion.value))
      .toEqual(['new', ...LEAD_RESERVATION_OUTCOMES, 'lost']);
  });

  it('ningún estado del embudo de clientes se queda sin rótulo', () => {
    for (const opcion of CONTACT_STATUS_OPTIONS) {
      expect(opcion.label, opcion.value).toBeTruthy();
      expect(opcion.color, opcion.value).toBeTruthy();
    }
  });
});
