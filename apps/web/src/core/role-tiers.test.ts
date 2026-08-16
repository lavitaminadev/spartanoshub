import { describe, expect, it } from 'vitest';
import { ROLE_TIER, ROLE_TIERS } from '../../../../packages/shared/src/constants/role-tiers';
import { UserRoles } from '../../../../packages/shared/src/enums';

describe('jerarquía de cargos', () => {
  it('clasifica todos los cargos una sola vez', () => {
    expect(Object.keys(ROLE_TIER).sort()).toEqual([...UserRoles].sort());
  });

  it('deja desarrollo como único cargo transversal técnico', () => {
    expect(ROLE_TIER.dev).toBe('transversal');
    expect(ROLE_TIER.admin).toBe('organization_direction');
    expect(ROLE_TIERS.find((tier) => tier.id === 'transversal')?.label).toBe('Desarrollo transversal');
  });

  it('ubica automatización en ejecución y cliente fuera de la escala interna', () => {
    expect(ROLE_TIER.ai_lead).toBe('execution');
    expect(ROLE_TIER.client).toBe('external');
  });
});
