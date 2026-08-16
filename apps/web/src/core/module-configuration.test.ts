import { describe, expect, it } from 'vitest';
import {
  ORGANIZATION_MODULE_CATALOG,
  buildAgencyCoreOrganizationFeatures,
} from '../../../../packages/shared/src/constants/modules';

describe('configuración recuperable de módulos', () => {
  it('mantiene gobierno disponible para auditoría y recuperación técnica', () => {
    expect(ORGANIZATION_MODULE_CATALOG.find((module) => module.key === 'governance')?.defaultEnabled).toBe(true);
    expect(buildAgencyCoreOrganizationFeatures().governance).toBe(true);
  });

  it('no confunde activar la organización con hacer visible un módulo en desarrollo', () => {
    const features = buildAgencyCoreOrganizationFeatures();
    expect(features.content).toBe(false);
    expect(ORGANIZATION_MODULE_CATALOG.find((module) => module.key === 'content')?.lifecycle).toBe('development');
  });
});
