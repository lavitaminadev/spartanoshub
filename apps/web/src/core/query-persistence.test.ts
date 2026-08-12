import { describe, expect, it } from 'vitest';
import { isPersistableQueryKey } from './query-persistence';

describe('isPersistableQueryKey', () => {
  it('guarda las consultas de datos de negocio', () => {
    expect(isPersistableQueryKey(['clients'])).toBe(true);
    expect(isPersistableQueryKey(['crm-reservation-contacts', 'client-1', 'reserved', 1])).toBe(true);
  });

  it('nunca guarda lo que decide el acceso', () => {
    // Responder esto desde una copia local mostraria permisos que el servidor pudo revocar.
    expect(isPersistableQueryKey(['sessions'])).toBe(false);
    expect(isPersistableQueryKey(['role-preview', 'admin'])).toBe(false);
    expect(isPersistableQueryKey(['roles', 'admin', 'permissions'])).toBe(false);
    expect(isPersistableQueryKey(['me'])).toBe(false);
  });

  it('tolera claves con partes que no son texto', () => {
    expect(isPersistableQueryKey(['pieces', 42, null, { clientId: 'client-1' }])).toBe(true);
  });
});
