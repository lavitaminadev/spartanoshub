import { describe, expect, it, vi } from 'vitest';
import { ImportLeadsUseCase } from '../../../src/modules/crm/leads/use-cases/import-leads.use-case';
import type { ImportLeadsDto } from '../../../src/modules/crm/leads/dto/import-leads.dto';

function useCaseWith(captureLead = vi.fn().mockResolvedValue(undefined), count = vi.fn().mockResolvedValue(0)) {
  const intake = { captureLead };
  const leads = { count };
  return { useCase: new ImportLeadsUseCase(intake as never, leads as never), captureLead, count };
}

function dto(rows: Array<Record<string, string>>): ImportLeadsDto {
  return { rows: rows as never, source: 'importacion' };
}

describe('ImportLeadsUseCase — una fila mala no detiene el archivo', () => {
  it('guarda las filas buenas y reporta la del correo inválido', async () => {
    const { useCase, captureLead } = useCaseWith();

    const result = await useCase.execute('org-1', dto([
      { name: 'Ana Rojas', email: 'ana@vitamina.cl' },
      { name: 'Bruno Díaz', email: 'bruno[arroba]vitamina.cl' },
      { name: 'Carla Soto', phone: '+56912345678' },
    ]));

    expect(result.imported).toBe(2);
    expect(captureLead).toHaveBeenCalledTimes(2);
    // La fila 3 de la planilla: la primera es el encabezado.
    expect(result.failed).toEqual([
      { row: 3, name: 'Bruno Díaz', reason: 'Correo con formato inválido: bruno[arroba]vitamina.cl' },
    ]);
  });

  it('rechaza la fila sin correo ni teléfono sin tocar las demás', async () => {
    const { useCase, captureLead } = useCaseWith();

    const result = await useCase.execute('org-1', dto([
      { name: 'Sin contacto' },
      { name: 'Ana Rojas', email: 'ana@vitamina.cl' },
    ]));

    expect(result.imported).toBe(1);
    expect(captureLead).toHaveBeenCalledTimes(1);
    expect(result.failed[0]).toMatchObject({ row: 2, reason: expect.stringContaining('Sin correo ni teléfono') });
  });

  it('no convierte en «hoy» una fecha de origen ilegible', async () => {
    const { useCase, captureLead } = useCaseWith();

    const result = await useCase.execute('org-1', dto([
      { name: 'Ana Rojas', email: 'ana@vitamina.cl', sourceCreatedAt: 'ayer por la tarde' },
    ]));

    expect(captureLead).not.toHaveBeenCalled();
    expect(result.failed[0].reason).toContain('Fecha de origen ilegible');
  });

  it('pasa la fecha de origen ya convertida, no el texto del archivo', async () => {
    const { useCase, captureLead } = useCaseWith();

    await useCase.execute('org-1', dto([
      { name: 'Ana Rojas', email: 'ana@vitamina.cl', sourceCreatedAt: '2026-03-04T10:00:00.000Z' },
    ]));

    expect(captureLead).toHaveBeenCalledWith(
      expect.objectContaining({ sourceCreatedAt: new Date('2026-03-04T10:00:00.000Z') }),
      'upsert',
    );
  });

  it('cuenta como actualización la fila de alguien que ya estaba', async () => {
    const { useCase } = useCaseWith(vi.fn().mockResolvedValue(undefined), vi.fn().mockResolvedValue(1));

    const result = await useCase.execute('org-1', dto([{ name: 'Ana Rojas', email: 'ana@vitamina.cl' }]));

    expect(result).toMatchObject({ imported: 0, duplicates: 1, failed: [] });
  });

  it('recorta los espacios y normaliza el correo antes de guardarlo', async () => {
    const { useCase, captureLead } = useCaseWith();

    await useCase.execute('org-1', dto([{ name: '  Ana Rojas  ', email: '  ANA@Vitamina.CL ' }]));

    expect(captureLead).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ana Rojas', email: 'ana@vitamina.cl' }),
      'upsert',
    );
  });
});

describe('ImportLeadsUseCase — a qué CRM y a qué cuenta entra el archivo', () => {
  it('marca las filas con el embudo elegido en vez de asumir el comercial', async () => {
    const { useCase, captureLead } = useCaseWith();

    await useCase.execute('org-1', {
      ...dto([{ name: 'Ana Rojas', email: 'ana@vitamina.cl' }]),
      domain: 'audience',
      clientId: 'client-1',
    });

    // Sin esto, los contactos de campaña de un cliente entraban al embudo de ventas de la
    // agencia, que es un CRM distinto y de otro equipo.
    expect(captureLead).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'audience', clientId: 'client-1' }),
      'upsert',
    );
  });

  it('mantiene el embudo comercial cuando el archivo no elige uno', async () => {
    const { useCase, captureLead } = useCaseWith();

    await useCase.execute('org-1', dto([{ name: 'Ana Rojas', email: 'ana@vitamina.cl' }]));

    expect(captureLead).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'commercial', clientId: undefined }),
      'upsert',
    );
  });

  it('busca el repetido dentro de la cuenta, no en toda la organización', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const { useCase } = useCaseWith(vi.fn().mockResolvedValue(undefined), count);

    await useCase.execute('org-1', {
      ...dto([{ name: 'Ana Rojas', email: 'ana@vitamina.cl' }]),
      domain: 'audience',
      clientId: 'client-1',
    });

    // `captureLead` acota su deduplicación por cuenta. Si el conteo no la acotara igual, el
    // resumen diría «ya existía» mientras la escritura da de alta un lead nuevo.
    expect(count).toHaveBeenCalledWith({
      where: [{ organizationId: 'org-1', clientId: 'client-1', email: 'ana@vitamina.cl' }],
    });
  });
});
