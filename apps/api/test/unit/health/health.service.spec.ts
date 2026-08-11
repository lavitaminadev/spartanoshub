import { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import apiPackage from '../../../package.json';
import { HealthService } from '../../../src/core/health/health.service';

describe('HealthService', () => {
  it('reports the packaged API version when Passenger starts outside npm', async () => {
    const dataSource = {
      query: vi.fn().mockResolvedValue([{ healthy: 1 }]),
    } as unknown as DataSource;
    const previousNpmVersion = process.env.npm_package_version;
    process.env.npm_package_version = '9.9.9';

    try {
      const result = await new HealthService(dataSource).check();

      expect(result.version).toBe(apiPackage.version);
      expect(result.version).toBe('1.0.0');
    } finally {
      if (previousNpmVersion === undefined) delete process.env.npm_package_version;
      else process.env.npm_package_version = previousNpmVersion;
    }
  });
});
