import { describe, expect, it } from 'vitest';
import { hasRoleAccess } from './role-access';

describe('hasRoleAccess', () => {
  it('permite a desarrollo atravesar los controles visuales de módulos activos', () => {
    expect(hasRoleAccess('dev', ['admin'])).toBe(true);
  });

  it('mantiene el control para los cargos operativos declarados', () => {
    expect(hasRoleAccess('designer', ['designer', 'art_director'])).toBe(true);
    expect(hasRoleAccess('client', ['designer', 'art_director'])).toBe(false);
  });
});
