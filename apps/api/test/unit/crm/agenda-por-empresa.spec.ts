import { describe, expect, it, vi } from 'vitest';
import { TasksController } from '../../../src/modules/approvals/tasks.controller';

/**
 * El calendario de una empresa muestra solo lo de esa empresa.
 *
 * Existe por un fallo real: las actividades filtraban por empresa y las tareas no, así que el
 * calendario de una cuenta mostraba las tareas de todas las que la persona alcanza. No era una
 * fuga de permisos —solo veía lo suyo— pero sí datos de una cuenta bajo el encabezado de otra,
 * que es la forma más silenciosa de mezclarlas y la más difícil de notar mirando la pantalla.
 */
function montar(permitidas?: string[]) {
  const tasks = { listAgenda: vi.fn().mockResolvedValue([]) };
  const accountAccess = {
    assertClient: vi.fn().mockResolvedValue(undefined),
    allowedClientIds: vi.fn().mockResolvedValue(permitidas),
  };

  const controller = new TasksController(
    tasks as never, {} as never, accountAccess as never, {} as never, {} as never,
  );
  return { controller, tasks, accountAccess };
}

const peticion = { organizationId: 'org-1', user: { id: 'u-1' } } as never;
const DESDE = '2026-08-01T00:00:00.000Z';
const HASTA = '2026-08-31T23:59:59.999Z';

describe('agenda de tareas por empresa', () => {
  it('con empresa elegida solo pide las de esa empresa', async () => {
    const { controller, tasks } = montar(['cliente-1', 'cliente-2']);

    await controller.agenda(peticion, DESDE, HASTA, 'cliente-1');

    expect(tasks.listAgenda).toHaveBeenCalledWith(
      'org-1', expect.any(Date), expect.any(Date), ['cliente-1'],
    );
  });

  it('comprueba que esa empresa se puede ver, además de acotar a ella', async () => {
    const { controller, accountAccess } = montar(['cliente-1']);

    await controller.agenda(peticion, DESDE, HASTA, 'cliente-1');

    expect(accountAccess.assertClient).toHaveBeenCalledWith('org-1', peticion.user, 'cliente-1');
  });

  it('sin empresa elegida acota a las que la persona alcanza', async () => {
    const { controller, tasks } = montar(['cliente-1', 'cliente-2']);

    await controller.agenda(peticion, DESDE, HASTA, undefined);

    expect(tasks.listAgenda).toHaveBeenCalledWith(
      'org-1', expect.any(Date), expect.any(Date), ['cliente-1', 'cliente-2'],
    );
  });

  /*
   * `undefined` significa «alcanza todas las cuentas», y es distinto de «no alcanza ninguna».
   * Confundirlos filtraría por una lista vacía y devolvería cero tareas a quien lo ve todo.
   */
  it('quien alcanza todas las cuentas no queda filtrado a ninguna', async () => {
    const { controller, tasks } = montar(undefined);

    await controller.agenda(peticion, DESDE, HASTA, undefined);

    expect(tasks.listAgenda).toHaveBeenCalledWith(
      'org-1', expect.any(Date), expect.any(Date), undefined,
    );
  });

  it('un rango sin fechas válidas se rechaza en vez de traer la tabla entera', async () => {
    const { controller, tasks } = montar();

    await expect(controller.agenda(peticion, 'no es fecha', HASTA)).rejects.toThrow();
    expect(tasks.listAgenda).not.toHaveBeenCalled();
  });
});
