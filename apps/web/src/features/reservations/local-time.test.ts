import { describe, expect, it } from 'vitest';
import { browserDateBoundaryUtc, localDateBoundsUtc } from './local-time';

describe('reservation date boundaries', () => {
  it('uses the reservation form timezone for a complete local day', () => {
    const range = localDateBoundsUtc('2026-01-20', 'America/Santiago');
    expect(range.from).toBe('2026-01-20T03:00:00.000Z');
    expect(range.to).toBe('2026-01-21T02:59:59.999Z');
  });

  it('makes the selected end date inclusive', () => {
    const boundary = browserDateBoundaryUtc('2026-08-10', true);
    expect(new Date(boundary).getTime()).toBeGreaterThan(new Date(browserDateBoundaryUtc('2026-08-10')).getTime());
  });
});
