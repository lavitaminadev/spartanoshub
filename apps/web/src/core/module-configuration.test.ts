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
   *
   * El ejemplo pasó de `content` a `surveys`. Los once módulos de empresa que se liberaron nacen
   * apagados —ahí `defaultEnabled` y la preselección vuelven a coincidir, por un motivo distinto—,
   * así que para seguir mostrando que son dos preguntas hace falta uno que el producto entregue
   * encendido y que no esté en la base mínima de una agencia.
   */
  it('el catálogo ofrece más de lo que preselecciona la base de agencia', () => {
    const features = buildAgencyCoreOrganizationFeatures();
    const marketing = ORGANIZATION_MODULE_CATALOG.find((module) => module.key === 'marketing');

    expect(marketing?.lifecycle).toBe('active');
    expect(marketing?.defaultEnabled).toBe(true);
    expect(features.marketing).toBe(false);
  });

  /*
   * Y los once liberados: activos en el catálogo, apagados de fábrica.
   *
   * Es la mitad que sostiene la decisión de abrirlos sin entregarlos. Si alguien los pusiera en
   * `defaultEnabled: true`, el producto los ofrecería y una organización nueva los recibiría
   * encendidos el mismo día, que es justo lo que no se quiso.
   */
  it('los módulos de empresa liberados están activos y nacen apagados', () => {
    for (const clave of ['content', 'production', 'meetings', 'documents', 'approvals', 'intake']) {
      const modulo = ORGANIZATION_MODULE_CATALOG.find((item) => item.key === clave);
      expect(modulo?.lifecycle, clave).toBe('active');
      expect(modulo?.defaultEnabled, clave).toBe(false);
    }
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
