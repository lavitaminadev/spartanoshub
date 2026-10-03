import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLAVE_ETAPAS_OCULTAS,
  CLAVE_PREGUNTAR_CALIFICACION,
  StageLabelsService,
} from '../../../src/modules/crm/leads/stage-labels.service';

/*
 * Las dos listas de etapas que una empresa configura.
 *
 * Son decisiones distintas —qué pasos existen, y en cuál se pregunta si el prospecto servía— y
 * comparten el mecanismo de guardado. Lo que hay que garantizar es justamente que lo compartan
 * sin mezclarse: cuando eran dos copias del mismo código, un arreglo en una no llegaba a la otra.
 */
function servicio(definiciones: Array<Record<string, unknown>> = [], filas: Array<Record<string, unknown>> = []) {
  const defs = {
    findOne: vi.fn(async ({ where }: { where: { key: string } }) => definiciones.find((d) => d.key === where.key) ?? null),
    create: vi.fn((d: Record<string, unknown>) => ({ ...d, id: `def-${d.key as string}` })),
    save: vi.fn(async (d: Record<string, unknown>) => { definiciones.push(d); return d; }),
  };
  const vals = {
    findOne: vi.fn(async ({ where }: { where: { definitionId: string } }) => (
      filas.find((f) => f.definitionId === where.definitionId) ?? null
    )),
    create: vi.fn((f: Record<string, unknown>) => ({ ...f, version: 1 })),
    save: vi.fn(async (f: Record<string, unknown>) => { if (!filas.includes(f)) filas.push(f); return f; }),
  };
  return { srv: new StageLabelsService(defs as never, vals as never), defs, vals, filas };
}

describe('etapas que una empresa configura', () => {
  beforeEach(() => vi.clearAllMocks());

  /* Sin fila guardada no es un error: es el valor de fábrica. */
  it('sin configurar, las dos listas vienen vacías', async () => {
    const { srv } = servicio();

    expect(await srv.ocultas('org-1', 'cli-1')).toEqual([]);
    expect(await srv.etapasQuePreguntan('org-1', 'cli-1')).toEqual([]);
  });

  it('guarda y devuelve las etapas en las que se pregunta', async () => {
    const { srv } = servicio();

    const guardadas = await srv.fijarEtapasQuePreguntan('org-1', 'cli-1', ['contacted', 'meeting_scheduled']);

    expect(guardadas).toEqual(['contacted', 'meeting_scheduled']);
    expect(await srv.etapasQuePreguntan('org-1', 'cli-1')).toEqual(['contacted', 'meeting_scheduled']);
  });

  /*
   * Lo que de verdad importa de compartir el mecanismo: que las dos claves no se pisen. Guardar en
   * una no puede cambiar la otra, o esconder una etapa haría que se dejara de preguntar en ella.
   */
  it('las dos listas no se pisan entre sí', async () => {
    const { srv } = servicio();

    await srv.ocultar('org-1', 'cli-1', ['no_show']);
    await srv.fijarEtapasQuePreguntan('org-1', 'cli-1', ['contacted']);

    expect(await srv.ocultas('org-1', 'cli-1')).toEqual(['no_show']);
    expect(await srv.etapasQuePreguntan('org-1', 'cli-1')).toEqual(['contacted']);
  });

  /* Un duplicado sólo engorda el JSON; la lista se compara por pertenencia. */
  it('limpia repetidos y vacíos', async () => {
    const { srv } = servicio();

    const guardadas = await srv.fijarEtapasQuePreguntan('org-1', 'cli-1', ['contacted', 'contacted', '  ', '']);

    expect(guardadas).toEqual(['contacted']);
  });

  /* Se guarda la lista completa: quitar una etapa es no incluirla. */
  it('guardar reemplaza la lista entera', async () => {
    const { srv } = servicio();

    await srv.fijarEtapasQuePreguntan('org-1', 'cli-1', ['contacted', 'negotiation']);
    await srv.fijarEtapasQuePreguntan('org-1', 'cli-1', ['negotiation']);

    expect(await srv.etapasQuePreguntan('org-1', 'cli-1')).toEqual(['negotiation']);
  });

  it('crea la definición la primera vez, con su clave propia', async () => {
    const { srv, defs } = servicio();

    await srv.fijarEtapasQuePreguntan('org-1', 'cli-1', ['contacted']);

    expect(defs.save).toHaveBeenCalledWith(expect.objectContaining({ key: CLAVE_PREGUNTAR_CALIFICACION }));
    expect(defs.save).not.toHaveBeenCalledWith(expect.objectContaining({ key: CLAVE_ETAPAS_OCULTAS }));
  });
});
