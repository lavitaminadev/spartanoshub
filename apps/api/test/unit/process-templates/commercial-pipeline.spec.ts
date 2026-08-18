import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_PIPELINE_TEMPLATE,
  PROCESS_TEMPLATE_DEFAULTS,
} from '../../../src/modules/process-templates/process-template-defaults';

/**
 * Las etapas del pipeline salieron del frontend y pasaron a ser una plantilla configurable.
 *
 * Lo que se puede cambiar desde Gobierno es la etiqueta y el orden. La `key` no: es el valor
 * que queda guardado en `crm_opportunities.stage` y en el historial de transiciones, así que
 * cambiar una deja huérfanos los tratos que ya la tienen.
 */
describe('plantilla del pipeline comercial', () => {
  const plantilla = PROCESS_TEMPLATE_DEFAULTS[COMMERCIAL_PIPELINE_TEMPLATE];

  it('existe y trae etapas', () => {
    expect(plantilla).toBeDefined();
    expect(plantilla.steps.length).toBeGreaterThan(0);
  });

  /**
   * Fija las claves que el resto del sistema ya guardó.
   *
   * Si alguien las cambia, esta prueba falla antes de que los tratos existentes queden
   * apuntando a una etapa que ya no está en la lista.
   */
  it('conserva las claves con las que ya hay tratos guardados', () => {
    expect(plantilla.steps.map((step) => step.key))
      .toEqual(['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost']);
  });

  /**
   * `won` y `lost` no son etapas cualesquiera: cerrar como perdido exige motivo, y la
   * automatización que abre el contrato escucha `won`. Su clave es parte del contrato.
   */
  it('mantiene las dos etapas de cierre al final', () => {
    const claves = plantilla.steps.map((step) => step.key);
    expect(claves.slice(-2)).toEqual(['won', 'lost']);
  });

  it('cada etapa declara etiqueta y responsable', () => {
    for (const step of plantilla.steps) {
      expect(step.label, step.key).toBeTruthy();
      expect(step.responsibleRole, step.key).toBeTruthy();
    }
  });

  it('no repite claves', () => {
    const claves = plantilla.steps.map((step) => step.key);
    expect(new Set(claves).size).toBe(claves.length);
  });
});
