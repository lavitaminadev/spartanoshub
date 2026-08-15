import { describe, expect, it, vi } from 'vitest';
import { UdValuesService } from '../../../src/modules/design-budget/ud-values.service';
import { PieceType } from '../../../src/modules/production/piece-type.enum';
import { PieceTypeStatus } from '../../../src/modules/production/piece-type-definition.entity';
import { ORGANIZATION_SETTINGS } from '../../../src/core/parameters/organization-settings.catalog';
import { udValueKey, UD_CAROUSEL_EXTRA_KEY } from '../../../src/modules/design-budget/ud-calculator';

type Definicion = { key: string; udAmount: number | null; extraPerUnit?: number | null; status?: PieceTypeStatus };

/**
 * Servicio con lo que la organización tendría configurado: parámetros sueltos y el catálogo de
 * tipos en base de datos.
 */
function crear(parametros: Record<string, number | null> = {}, catalogo: Definicion[] = []) {
  const parameters = {
    getManyForOrganization: vi.fn(async (keys: string[]) =>
      new Map(keys.map((key) => [key, key in parametros ? parametros[key] : null]))),
    get: vi.fn(async (key: string) => (key in parametros ? parametros[key] : null)),
  } as any;

  const definitions = {
    find: vi.fn(async () => catalogo.map((row) => ({ status: PieceTypeStatus.ACTIVE, ...row }))),
    findOne: vi.fn(async ({ where }: any) => catalogo.find((row) => row.key === where.key) ?? null),
  } as any;

  return new UdValuesService(parameters, definitions);
}

describe('UdValuesService', () => {
  it('usa la matriz del Documento Maestro cuando no hay nada configurado', async () => {
    const service = crear();
    expect(await service.udFor(PieceType.POST_SIMPLE, 0, 'org-1')).toBe(1.0);
    expect(await service.udFor(PieceType.FLYER_PRINT, 0, 'org-1')).toBe(2.0);
  });

  it('respeta el parámetro por encima del valor por defecto', async () => {
    const service = crear({ [udValueKey(PieceType.POST_SIMPLE)]: 2.5 });
    expect(await service.udFor(PieceType.POST_SIMPLE, 0, 'org-1')).toBe(2.5);
  });

  it('el catálogo de la organización manda sobre el parámetro y sobre el maestro', async () => {
    const service = crear(
      { [udValueKey(PieceType.POST_SIMPLE)]: 2.5 },
      [{ key: PieceType.POST_SIMPLE, udAmount: 4 }],
    );
    expect(await service.udFor(PieceType.POST_SIMPLE, 0, 'org-1')).toBe(4);
  });

  it('cobra un tipo creado después de compilar, que el enum no conoce', async () => {
    const service = crear({}, [{ key: 'reel_editado', udAmount: 6 }]);
    expect(await service.udFor('reel_editado', 0, 'org-1')).toBe(6);
  });

  it('permite valorar a posteriori un tipo que nacía sin valor', async () => {
    const sinValorar = crear();
    expect(await sinValorar.udFor(PieceType.LOGO, 0, 'org-1')).toBe(0);
    expect(await sinValorar.tiposSinValor('org-1')).toContain(PieceType.LOGO);

    const valorado = crear({}, [{ key: PieceType.LOGO, udAmount: 8 }]);
    expect(await valorado.udFor(PieceType.LOGO, 0, 'org-1')).toBe(8);
    expect(await valorado.tiposSinValor('org-1')).not.toContain(PieceType.LOGO);
  });

  it('sigue cobrando un tipo retirado, porque sus piezas vivas hay que poder liquidarlas', async () => {
    const service = crear({}, [{ key: 'paloma', udAmount: 2, status: PieceTypeStatus.RETIRED }]);
    expect(await service.udFor('paloma', 0, 'org-1')).toBe(2);
  });

  it('cobra el carrusel por base más extra por lámina', async () => {
    expect(await crear().udFor(PieceType.CAROUSEL, 4, 'org-1')).toBeCloseTo(1.0 + 3 * 0.4);

    const ajustado = crear({ [udValueKey(PieceType.CAROUSEL)]: 2, [UD_CAROUSEL_EXTRA_KEY]: 0.5 });
    expect(await ajustado.udFor(PieceType.CAROUSEL, 4, 'org-1')).toBeCloseTo(2 + 3 * 0.5);
  });

  it('permite que un tipo nuevo se cobre por tramos sin que el código lo sepa', async () => {
    const service = crear({}, [{ key: 'serie_fotos', udAmount: 1, extraPerUnit: 0.25 }]);
    expect(await service.udFor('serie_fotos', 5, 'org-1')).toBeCloseTo(1 + 4 * 0.25);
  });

  it('expone los tipos del maestro en el catálogo de configuración', () => {
    const claves = new Set(ORGANIZATION_SETTINGS.map((setting) => setting.key));
    for (const type of Object.values(PieceType)) expect(claves.has(udValueKey(type))).toBe(true);
    expect(claves.has(UD_CAROUSEL_EXTRA_KEY)).toBe(true);
  });
});
