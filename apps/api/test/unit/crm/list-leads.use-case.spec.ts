import { describe, expect, it, vi } from 'vitest';
import { ListLeadsUseCase } from '../../../src/modules/crm/leads/use-cases/list-leads.use-case';

/** Columnas de `Lead` que las condiciones agrupadas mencionan por su nombre en la base. */
const COLUMNAS: Record<string, string> = {
  updatedAt: 'updated_at',
  sourceDetail: 'source_detail',
  campaignName: 'campaign_name',
};

function caso() {
  const repo = {
    findAndCount: vi.fn().mockResolvedValue([[], 0]),
    // El use-case traduce propiedades a columnas por los metadatos en vez de escribirlas a mano.
    metadata: {
      name: 'Lead',
      findColumnWithPropertyName: (propiedad: string) => ({ databaseName: COLUMNAS[propiedad] ?? propiedad }),
    },
    manager: { connection: { driver: { escape: (nombre: string) => `\`${nombre}\`` } } },
  };
  return { uso: new ListLeadsUseCase(repo as never), repo };
}

/** El criterio con que se consultó. */
function criterio(repo: { findAndCount: { mock: { calls: unknown[][] } } }) {
  return (repo.findAndCount.mock.calls[0][0] as { where: unknown }).where;
}

/** El SQL que una condición agrupada produce para su columna. */
function sqlDe(condicion: any, columna: string): string {
  return condicion.getSql(columna);
}

describe('ListLeadsUseCase · forma de la consulta', () => {
  /*
   * El `where` es una sola conjunción, nunca criterios alternativos.
   *
   * Es la garantía que sostiene todo lo demás de este archivo. Expresar un «o» como criterios
   * alternativos al `where` completo obliga a repetir las otras condiciones en cada rama, y con
   * esa forma el motor no usa ningún índice: recorre la tabla entera y reevalúa cada condición
   * una vez por rama. Medido sobre 250.000 filas, el peor caso —búsqueda libre más filtro de
   * anuncio, con las tres disyunciones a la vez— pasó de 17.627 ms a 637 ms, y de 168 parámetros
   * a 13. La §13 de docs/AUDITORIA-FASE4-FILTROS-2026-10-14.md tiene la medición.
   */
  it('nunca arma criterios alternativos, ni con las tres disyunciones juntas', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, {
      search: 'gomez', onlyAssignedTo: 'user-7', anuncio: 'Inversion A', clientId: 'cliente-9',
    });
    expect(Array.isArray(criterio(repo))).toBe(false);
  });
});

describe('ListLeadsUseCase · alcance por persona', () => {
  it('el corte de cerrados es una sola condición agrupada', async () => {
    // «No está cerrado, o se cerró hace poco» va entre paréntesis dentro del mismo `where`.
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, {});
    const donde = criterio(repo) as Record<string, any>;

    expect(Array.isArray(donde)).toBe(false);
    expect(donde.status?._type).toBe('raw');
    expect(sqlDe(donde.status, '`Lead`.`status`'))
      .toBe('(`Lead`.`status` NOT IN (:...cerradas) OR `Lead`.`updated_at` >= :limite)');
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
    const donde = criterio(repo) as Record<string, any>;
    const limite = new Date(donde.status?._objectLiteralParameters?.limite as Date);
    const dias = (Date.now() - limite.getTime()) / 86_400_000;

    expect(dias).toBeGreaterThan(29.5);
    expect(dias).toBeLessThan(30.5);
    // Lo que descarta el mes de calendario: el día 1 el límite daría casi cero días de antigüedad.
    expect(limite.getDate()).not.toBe(1);
  });

  /*
   * El corte sólo alcanza a los cerrados.
   *
   * Un prospecto en cualquier otro estado se ve siempre, sin límite de fecha: si el corte lo
   * alcanzara, una ficha viva desaparecería del tablero por antigüedad y se leería como perdida.
   * Por eso la fecha está del lado derecho del «o» y no fuera del paréntesis: un lead abierto
   * entra por el lado izquierdo sin que su fecha importe.
   */
  it('no acota por fecha a los que no están cerrados', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, {});
    const donde = criterio(repo) as Record<string, any>;
    const sql = sqlDe(donde.status, '`Lead`.`status`');

    expect(sql).toMatch(/NOT IN \(:\.\.\.cerradas\) OR/);
    expect(donde.updatedAt).toBeUndefined();
    expect(donde.createdAt).toBeUndefined();
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
    const donde = criterio(repo) as Record<string, any>;

    expect(donde.status?._objectLiteralParameters?.cerradas).toEqual(['lost', 'won']);
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
    expect(donde.status).toBeUndefined();
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

  it('pedirlos explícitamente quita el corte', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, { incluirDescartados: true });
    const donde = criterio(repo) as Record<string, any>;

    expect(Array.isArray(donde)).toBe(false);
    expect(donde.status).toBeUndefined();
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
    const donde = criterio(repo) as Record<string, any>;

    expect(sqlDe(donde.assignedTo, '`Lead`.`assigned_to`'))
      .toBe('(`Lead`.`assigned_to` = :suyo OR `Lead`.`assigned_to` IS NULL)');
    expect(donde.assignedTo?._objectLiteralParameters?.suyo).toBe('user-7');
  });

  /*
   * El filtro de empresa ya no puede quedar abierto por un lado.
   *
   * Antes el «o» del alcance por persona eran dos criterios alternativos con el `where` repetido
   * en cada uno, y había que vigilar que ninguna rama olvidara una condición que la otra sí
   * aplicaba. Ahora la disyunción vive dentro de la condición de su propia columna, así que las
   * rejas son condiciones únicas de la conjunción y no hay dos sitios que mantener de acuerdo.
   */
  it('el alcance por persona no abre ninguna reja de empresa', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, {
      onlyAssignedTo: 'user-7', clientId: 'cliente-9', domain: 'audience', incluirDescartados: true,
    });
    const donde = criterio(repo) as Record<string, any>;

    expect(Array.isArray(donde)).toBe(false);
    expect(donde.organizationId).toBe('org-1');
    expect(donde.clientId).toBe('cliente-9');
    expect(donde.domain).toBe('audience');
    // La disyunción queda confinada a su columna: no alcanza a las de arriba.
    expect(donde.assignedTo?._type).toBe('raw');
  });

  it('sin cuentas permitidas no consulta y devuelve vacío, aunque esté acotado por persona', async () => {
    const { uso, repo } = caso();
    const resultado = await uso.execute('org-1', 20, 0, { onlyAssignedTo: 'user-7', allowedClientIds: [] });
    expect(resultado.total).toBe(0);
    expect(repo.findAndCount).not.toHaveBeenCalled();
  });

  it('busca en los siete campos sin perder el alcance de empresa', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 100, 0, {
      clientId: 'cliente-9', domain: 'audience', search: 'ana', incluirDescartados: true,
    });
    const donde = criterio(repo) as Record<string, any>;
    const sql = sqlDe(donde.name, '`Lead`.`name`');

    expect(Array.isArray(donde)).toBe(false);
    expect(donde.organizationId).toBe('org-1');
    expect(donde.clientId).toBe('cliente-9');
    expect(donde.domain).toBe('audience');
    // Los siete campos, en un solo paréntesis y con un único parámetro para el término.
    for (const columna of ['name', 'email', 'phone', 'company', 'source', 'source_detail', 'campaign_name']) {
      expect(sql).toContain(`\`Lead\`.\`${columna}\` LIKE :termino`);
    }
    expect(sql.match(/ OR /g)).toHaveLength(6);
    expect(donde.name?._objectLiteralParameters?.termino).toBe('%ana%');
  });
});
