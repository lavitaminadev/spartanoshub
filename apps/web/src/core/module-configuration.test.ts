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
   * El catálogo y la preselección siguen siendo dos decisiones distintas.
   *
   * Todos los módulos están activos y todos arrancan encendidos: el producto los ofrece y una
   * organización nueva los recibe. La preselección `AGENCY_CORE` es otra cosa —el conjunto
   * mínimo con el que se levanta una agencia— y deja fuera lo que no forma parte de esa base.
   *
   * Antes las dos coincidían porque 22 módulos venían apagados de fábrica, y esa coincidencia
   * escondía que respondían preguntas diferentes.
   */
  it('el catálogo ofrece más de lo que preselecciona la base de agencia', () => {
    const features = buildAgencyCoreOrganizationFeatures();
    const content = ORGANIZATION_MODULE_CATALOG.find((module) => module.key === 'content');

    expect(content?.lifecycle).toBe('active');
    expect(content?.defaultEnabled).toBe(true);
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
