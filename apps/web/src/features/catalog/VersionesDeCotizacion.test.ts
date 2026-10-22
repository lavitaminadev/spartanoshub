import { describe, expect, it } from 'vitest';
import { hitoDeVersion } from './VersionesDeCotizacion';

describe('hitoDeVersion', () => {
  const base = { status: 'draft', sentAt: null, acceptedAt: null, createdAt: '2026-03-03T15:00:00Z' };
  it('distingue enviada, aceptada y sin enviar', () => {
    expect(hitoDeVersion({ ...base, sentAt: '2026-03-03T15:00:00Z' })).toMatch(/^enviada el 3 de marzo/);
    expect(hitoDeVersion({ ...base, acceptedAt: '2026-03-20T15:00:00Z' })).toMatch(/^aceptada el 20 de marzo/);
    expect(hitoDeVersion(base)).toMatch(/sin enviar$/);
  });
});
