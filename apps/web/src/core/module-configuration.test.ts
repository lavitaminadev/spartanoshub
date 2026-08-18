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

  /**
   * El ciclo de vida y el interruptor siguen siendo dos decisiones distintas.
   *
   * Desde que todos los módulos están activos, el catálogo dice que el producto los ofrece;
   * el interruptor dice cuáles se usan. La preselección base deja fuera lo que no forma parte
   * de la operación diaria, y eso no cambió al abrirlos.
   */
  it('ofrecer un módulo no es lo mismo que encenderlo', () => {
    const features = buildAgencyCoreOrganizationFeatures();
    const content = ORGANIZATION_MODULE_CATALOG.find((module) => module.key === 'content');

    expect(content?.lifecycle).toBe('active');
    expect(content?.defaultEnabled).toBe(false);
    expect(features.content).toBe(false);
  });

  /**
   * Fija que el catálogo ya no esconde nada.
   *
   * Si alguien vuelve a poner un módulo en `development`, esta prueba falla y obliga a
   * declarar por qué: cerrarlo desde el código vuelve a exigir un despliegue para reabrirlo,
   * que es justo lo que se quitó.
   */
  it('ningún módulo queda cerrado desde el código', () => {
    const cerrados = ORGANIZATION_MODULE_CATALOG.filter((module) => module.lifecycle !== 'active');
    expect(cerrados.map((module) => module.key)).toEqual([]);
  });
});
