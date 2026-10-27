/**
 * Para qué empresa se puede emitir una llave de entrada de leads.
 *
 * Una llave de entrada **escribe** en el CRM sin sesión: es el caso en que poder nombrar una
 * empresa ajena es peor que poder leerla. Quien lleva la cuenta A podía emitir una llave que
 * mete leads en la cuenta B con sólo escribir su identificador en el cuerpo, y la llave quedaba
 * en manos de quien la pidió mientras rotarla o apagarla seguía siendo del lado de B.
 *
 * Rotar, apagar y revocar ya comprobaban la empresa al buscar el origen. Emitir era la única
 * puerta que aceptaba cualquier identificador, y es la que crea el acceso.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { IngestSourcesController } from '../../../src/modules/crm/leads/ingest-sources.controller';

const PETICION = { organizationId: 'org-1', user: { id: 'u1', role: 'community_manager', organizationId: 'org-1' } } as never;

function montar(alcanzables: string[] | undefined) {
  const sources = { create: (fila: unknown) => fila, find: vi.fn().mockResolvedValue([]) };
  const emitidos: Array<{ clientId: string | null }> = [];
  const ingest = {
    issueToken: vi.fn(async (fila: { clientId: string | null }) => {
      emitidos.push(fila);
      return { source: { ...fila, id: 'o-1', name: 'Meta', source: 'meta' }, token: 'llave' };
    }),
  };
  const accountAccess = {
    allowedClientIds: vi.fn().mockResolvedValue(alcanzables),
    assertClient: vi.fn(async (_org: string, _user: unknown, clientId: string) => {
      if (alcanzables !== undefined && !alcanzables.includes(clientId)) throw new NotFoundException('Client not found');
    }),
  };
  return { controller: new IngestSourcesController(sources as never, ingest as never, accountAccess as never), emitidos };
}

const CUERPO = { name: 'Meta Ads', source: 'meta' };

describe('emitir una llave de entrada', () => {
  it('no se emite para una empresa que no se lleva', async () => {
    const { controller, emitidos } = montar(['mia']);

    await expect(controller.create({ ...CUERPO, clientId: 'ajena' } as never, PETICION)).rejects.toThrow(NotFoundException);
    expect(emitidos).toEqual([]);
  });

  it('se emite para una empresa que sí se lleva', async () => {
    const { controller, emitidos } = montar(['mia']);

    const salida = await controller.create({ ...CUERPO, clientId: 'mia' } as never, PETICION);
    expect(salida.token).toBe('llave');
    expect(emitidos[0].clientId).toBe('mia');
  });

  /*
   * Un origen sin empresa es de la agencia, y el listado sólo lo muestra a los cargos sin
   * límite: quien lleva cuentas concretas lo crearía sin poder volver a verlo, con la llave ya
   * emitida y nadie a quien reclamarle el contador.
   */
  it('quien lleva cuentas concretas no puede crear un origen sin empresa', async () => {
    const { controller, emitidos } = montar(['mia']);

    await expect(controller.create(CUERPO as never, PETICION)).rejects.toThrow(BadRequestException);
    expect(emitidos).toEqual([]);
  });

  it('un cargo sin límite de alcance sí puede crear el de la agencia', async () => {
    const { controller, emitidos } = montar(undefined);

    await controller.create(CUERPO as never, PETICION);
    expect(emitidos[0].clientId).toBeNull();
  });

  it('una empresa escrita con espacios no cuenta como «sin empresa»', async () => {
    const { controller } = montar(['mia']);

    await expect(controller.create({ ...CUERPO, clientId: '  ajena  ' } as never, PETICION)).rejects.toThrow(NotFoundException);
  });
});
