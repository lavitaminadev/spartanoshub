import { describe, expect, it, vi } from 'vitest';
import { UdValuesService } from '../../../src/modules/design-budget/ud-values.service';
import { PieceType } from '../../../src/modules/production/piece-type.enum';
import { ORGANIZATION_SETTINGS } from '../../../src/core/parameters/organization-settings.catalog';
import { udValueKey, UD_CAROUSEL_EXTRA_KEY } from '../../../src/modules/design-budget/ud-calculator';

/** Resolutor de parámetros con los valores que la organización tendría configurados. */
function resolver(configurado: Record<string, number | null> = {}) {
  return {
    getManyForOrganization: vi.fn(async (keys: string[]) =>
      new Map(keys.map((key) => [key, key in configurado ? configurado[key] : null]))),
    get: vi.fn(async (key: string) => (key in configurado ? configurado[key] : null)),
  } as any;
}

describe('UdValuesService', () => {
  it('usa la matriz del Documento Maestro cuando la organización no configuró nada', async () => {
    const service = new UdValuesService(resolver());
    expect(await service.udFor(PieceType.POST_SIMPLE, 0, 'org-1')).toBe(1.0);
    expect(await service.udFor(PieceType.FLYER_PRINT, 0, 'org-1')).toBe(2.0);
  });

  it('respeta el valor configurado por encima del valor por defecto', async () => {
    const service = new UdValuesService(resolver({ [udValueKey(PieceType.POST_SIMPLE)]: 2.5 }));
    expect(await service.udFor(PieceType.POST_SIMPLE, 0, 'org-1')).toBe(2.5);
  });

  it('permite valorar a posteriori un tipo que nacía sin valor', async () => {
    const sinValorar = new UdValuesService(resolver());
    expect(await sinValorar.udFor(PieceType.LOGO, 0, 'org-1')).toBe(0);
    expect(await sinValorar.tiposSinValor('org-1')).toContain(PieceType.LOGO);

    const valorado = new UdValuesService(resolver({ [udValueKey(PieceType.LOGO)]: 8 }));
    expect(await valorado.udFor(PieceType.LOGO, 0, 'org-1')).toBe(8);
    expect(await valorado.tiposSinValor('org-1')).not.toContain(PieceType.LOGO);
  });

  it('cobra el carrusel por base más extra por lámina, ambos configurables', async () => {
    const porDefecto = new UdValuesService(resolver());
    expect(await porDefecto.udFor(PieceType.CAROUSEL, 4, 'org-1')).toBeCloseTo(1.0 + 3 * 0.4);

    const ajustado = new UdValuesService(resolver({
      [udValueKey(PieceType.CAROUSEL)]: 2,
      [UD_CAROUSEL_EXTRA_KEY]: 0.5,
    }));
    expect(await ajustado.udFor(PieceType.CAROUSEL, 4, 'org-1')).toBeCloseTo(2 + 3 * 0.5);
  });

  it('expone todos los tipos de pieza en el catálogo de configuración', () => {
    const claves = new Set(ORGANIZATION_SETTINGS.map((setting) => setting.key));
    for (const type of Object.values(PieceType)) {
      expect(claves.has(udValueKey(type))).toBe(true);
    }
    expect(claves.has(UD_CAROUSEL_EXTRA_KEY)).toBe(true);
  });
});
