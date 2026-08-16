import { describe, expect, it } from 'vitest';
import { normalizeOrganizationFeatures } from '../../../src/modules/organizations/organization-features';

describe('normalizeOrganizationFeatures', () => {
  it('mantiene disponible el dashboard aunque una configuración histórica lo haya apagado', () => {
    expect(normalizeOrganizationFeatures({ dashboard: false }).dashboard).toBe(true);
  });

  it('conserva los interruptores opcionales de la organización', () => {
    expect(normalizeOrganizationFeatures({ reservations: false }).reservations).toBe(false);
  });
});
