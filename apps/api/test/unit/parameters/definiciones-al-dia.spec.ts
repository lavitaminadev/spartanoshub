import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationSettingsService } from '../../../src/core/parameters/organization-settings.service';
import { ORGANIZATION_SETTINGS } from '../../../src/core/parameters/organization-settings.catalog';

/**
 * El valor de fábrica vive en el código; la fila de la base sólo lo copia.
 *
 * Cuando esa copia se hacía una vez y no se volvía a mirar, las dos versiones se separaban en
 * silencio: la pantalla de módulos leía el catálogo y el resolutor de permisos leía la fila, de
 * modo que Encuestas se mostraba «activo» y se comportaba como «en desarrollo» para todo el
 * equipo. Ocurrió en producción y costó una tarde encontrarlo.
 */
describe('definiciones de configuración al día', () => {
  const ejemplo = ORGANIZATION_SETTINGS.find((setting) => setting.key === 'modules.lifecycle.surveys')!;

  const definitionRepo = {
    find: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    createQueryBuilder: vi.fn(() => ({ insert: () => ({ values: () => ({ orIgnore: () => ({ execute: vi.fn() }) }) }) })),
  };
  const valueRepo = { find: vi.fn().mockResolvedValue([]) };
  let service: OrganizationSettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrganizationSettingsService(definitionRepo as never, valueRepo as never, {} as never, {} as never, {} as never);
  });

  /** Todas al día salvo la que se quiera desfasar: `list` recorre el catálogo completo. */
  const filas = (desfasada?: { key: string; value: unknown }) => ORGANIZATION_SETTINGS.map((setting, indice) => ({
    id: `def-${indice}`,
    key: setting.key,
    defaultValue: { value: setting.key === desfasada?.key ? desfasada.value : setting.defaultValue },
  }));

  it('corrige la fila cuyo valor de fábrica quedó atrás', async () => {
    definitionRepo.find.mockResolvedValue(filas({ key: ejemplo.key, value: 'development' }));
    const id = `def-${ORGANIZATION_SETTINGS.findIndex((setting) => setting.key === ejemplo.key)}`;

    await service.list('org-1');

    expect(definitionRepo.update).toHaveBeenCalledWith(id, { defaultValue: { value: ejemplo.defaultValue } });
  });

  it('no reescribe la fila que ya coincide', async () => {
    definitionRepo.find.mockResolvedValue(filas());

    await service.list('org-1');

    expect(definitionRepo.update).not.toHaveBeenCalled();
  });
});
