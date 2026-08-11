import { describe, expect, it } from 'vitest';
import { buildSessionHostWarning } from './session-host-warning';

describe('buildSessionHostWarning', () => {
  it('does not warn when production intentionally uses separate web and API subdomains', () => {
    expect(buildSessionHostWarning({
      isDevelopment: false,
      webHost: 'cuartel.espartanos.cl',
      rawApiUrl: 'https://refugio.espartanos.cl/api',
    })).toBeNull();
  });

  it('warns in development when the configured API uses another host', () => {
    expect(buildSessionHostWarning({
      isDevelopment: true,
      webHost: 'localhost',
      rawApiUrl: 'http://refugio.espartanos.cl/api',
    })).toContain('refugio.espartanos.cl');
  });

  it('does not warn for same-host or relative development APIs', () => {
    expect(buildSessionHostWarning({
      isDevelopment: true,
      webHost: 'localhost',
      rawApiUrl: 'http://localhost:3000/api',
    })).toBeNull();
    expect(buildSessionHostWarning({
      isDevelopment: true,
      webHost: 'localhost',
      rawApiUrl: '/api',
    })).toBeNull();
  });
});
