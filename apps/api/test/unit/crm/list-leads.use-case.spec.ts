import { describe, expect, it, vi } from 'vitest';
import { ListLeadsUseCase } from '../../../src/modules/crm/leads/use-cases/list-leads.use-case';

function caso() {
  const repo = { findAndCount: vi.fn().mockResolvedValue([[], 0]) };
  return { uso: new ListLeadsUseCase(repo as never), repo };
}

/** El criterio con que se consultó, sea objeto o disyunción. */
function criterio(repo: { findAndCount: { mock: { calls: unknown[][] } } }) {
  return (repo.findAndCount.mock.calls[0][0] as { where: unknown }).where;
}

describe('ListLeadsUseCase · alcance por persona', () => {
  it('sin acotar consulta las dos ramas del corte de descartados', async () => {
    // Ya no es un criterio único: ocultar los descartados viejos es una disyunción —«no está
    // descartado, o se descartó hace poco»—, y en TypeORM eso son dos condiciones completas.
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, {});
    const donde = criterio(repo) as Array<Record<string, any>>;
    expect(donde).toHaveLength(2);
    expect(donde[0].status?._type).toBe('not');
    expect(donde[1].status?._value).toEqual(['lost', 'won']);
    expect(donde[1].updatedAt?._type).toBe('moreThanOrEqual');
  });

  /*
   * El corte es una ventana móvil, no el día 1 del mes.
   *
   * Con el mes de calendario, un descarte del 31 desaparecía al día siguiente y uno del 2 duraba
   * treinta días: el mismo hecho con vidas en pantalla que se diferenciaban en treinta veces, por
   * una fecha que no significa nada para quien vende.
   */
  it('mira los últimos treinta días y no el inicio del mes', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, {});
    const donde = criterio(repo) as Array<Record<string, any>>;
    const limite = new Date(donde[1].updatedAt?._value as string | Date);
    const dias = (Date.now() - limite.getTime()) / 86_400_000;

    expect(dias).toBeGreaterThan(29.5);
    expect(dias).toBeLessThan(30.5);
    // Lo que descarta el mes de calendario: el día 1 el límite daría casi cero días de antigüedad.
    expect(limite.getDate()).not.toBe(1);
  });

  /*
   * El corte sólo alcanza a los descartados.
   *
   * Un prospecto en cualquier otro estado se ve siempre, sin límite de fecha: si el corte lo
   * alcanzara, una ficha viva desaparecería del tablero por antigüedad y se leería como perdida.
   */
  it('no acota por fecha a los que no están descartados', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, {});
    const donde = criterio(repo) as Array<Record<string, any>>;

    expect(donde[0].status?._type).toBe('not');
    expect(donde[0].updatedAt).toBeUndefined();
    expect(donde[0].createdAt).toBeUndefined();
  });

  /*
   * El corte alcanza a los dos desenlaces, no sólo al descarte.
   *
   * Una venta cerrada tampoco es trabajo del día. Lo que no puede desaparecer nunca es un lead
   * abierto: si se fuera por antigüedad, una ficha viva se leería como perdida.
   */
  it('saca de la vista los vendidos antiguos, igual que los descartados', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, {});
    const donde = criterio(repo) as Array<Record<string, any>>;

    expect(donde[1].status?._type).toBe('in');
    expect(donde[1].status?._value).toEqual(['lost', 'won']);
    expect(donde[0].status?._type).toBe('not');
    expect(donde[0].status?._value?._value).toEqual(['lost', 'won']);
  });

  /*
   * Pedir un período muestra también lo cerrado de esas fechas.
   *
   * Quien escribe «septiembre» quiere septiembre entero. Recortar además por antigüedad devolvería
   * menos de lo pedido sin decir por qué, y el número de arriba no cuadraría con lo que se ve.
   */
  it('acotar por fechas desactiva el corte de cerrados', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, { desde: '2026-09-01', hasta: '2026-09-30' });
    const donde = criterio(repo) as Record<string, any>;

    expect(Array.isArray(donde)).toBe(false);
    expect(donde.createdAt?._type).toBe('between');
  });

  it('el día de «hasta» entra entero', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, { hasta: '2026-09-30' });
    const donde = criterio(repo) as Record<string, any>;
    const tope = new Date(donde.createdAt?._value as Date);

    expect(tope.getDate()).toBe(30);
    expect(tope.getHours()).toBe(23);
  });

  it('sólo «desde» acota por el extremo inferior', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, { desde: '2026-09-01' });
    const donde = criterio(repo) as Record<string, any>;

    expect(donde.createdAt?._type).toBe('moreThanOrEqual');
  });

  it('pedirlos explícitamente vuelve al criterio único', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, { incluirDescartados: true });
    expect(Array.isArray(criterio(repo))).toBe(false);
  });

  it('filtrar por una etapa manda sobre el corte', async () => {
    // Pedir «Descartado» ya es decir que se quieren ver: acotar además por fecha devolvería
    // vacío para un filtro que la persona eligió a mano.
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, { status: 'lost' });
    const donde = criterio(repo) as Record<string, any>;
    expect(Array.isArray(donde)).toBe(false);
    expect(donde.status).toBe('lost');
    expect(donde.updatedAt).toBeUndefined();
  });

  it('el embudo de la agencia excluye cualquier lead asociado a una empresa', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, { domain: 'commercial', agencyOnly: true, incluirDescartados: true });
    const donde = criterio(repo) as Record<string, any>;
    expect(donde.domain).toBe('commercial');
    expect(donde.clientId?._type).toBe('isNull');
  });

  it('una persona acotada nunca obtiene el embudo propio de la agencia', async () => {
    const { uso, repo } = caso();
    const resultado = await uso.execute('org-1', 20, 0, {
      domain: 'commercial', agencyOnly: true, allowedClientIds: ['cliente-9'],
    });
    expect(resultado.total).toBe(0);
    expect(repo.findAndCount).not.toHaveBeenCalled();
  });

  it('acotado devuelve lo suyo o lo que no tiene dueño', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, { onlyAssignedTo: 'user-7', incluirDescartados: true });
    const donde = criterio(repo) as Array<Record<string, unknown>>;
    expect(donde).toHaveLength(2);
    expect(donde[0].assignedTo).toBe('user-7');
    // La segunda rama es «sin dueño»: se comprueba que no sea el mismo usuario ni quede libre.
    expect(donde[1].assignedTo).not.toBe('user-7');
    expect(donde[1].assignedTo).toBeDefined();
  });

  it('las dos ramas llevan el filtro de empresa completo, o una abriría lo que la otra cierra', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, {
      onlyAssignedTo: 'user-7', clientId: 'cliente-9', domain: 'audience', incluirDescartados: true,
    });
    const donde = criterio(repo) as Array<Record<string, unknown>>;
    for (const rama of donde) {
      expect(rama.organizationId).toBe('org-1');
      expect(rama.clientId).toBe('cliente-9');
      expect(rama.domain).toBe('audience');
    }
  });

  it('sin cuentas permitidas no consulta y devuelve vacío, aunque esté acotado por persona', async () => {
    const { uso, repo } = caso();
    const resultado = await uso.execute('org-1', 20, 0, { onlyAssignedTo: 'user-7', allowedClientIds: [] });
    expect(resultado.total).toBe(0);
    expect(repo.findAndCount).not.toHaveBeenCalled();
  });

  it('busca en base sobre todos los campos sin perder el alcance de empresa', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 100, 0, {
      clientId: 'cliente-9', domain: 'audience', search: 'ana', incluirDescartados: true,
    });
    const donde = criterio(repo) as Array<Record<string, unknown>>;
    expect(donde).toHaveLength(7);
    for (const rama of donde) {
      expect(rama.organizationId).toBe('org-1');
      expect(rama.clientId).toBe('cliente-9');
      expect(rama.domain).toBe('audience');
    }
    expect(donde.some((rama) => rama.name)).toBe(true);
    expect(donde.some((rama) => rama.email)).toBe(true);
    expect(donde.some((rama) => rama.phone)).toBe(true);
  });
});
