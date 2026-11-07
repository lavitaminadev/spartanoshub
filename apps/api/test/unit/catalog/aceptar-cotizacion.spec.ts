import { describe, expect, it, vi } from 'vitest';
import { QuotesService } from '../../../src/modules/catalog/quotes.service';
import { QuoteStatus } from '../../../src/modules/catalog/quote-status.enum';
import { Client } from '../../../src/modules/clients/client.entity';
import { Contract } from '../../../src/modules/contracts/contract.entity';
import { Lead } from '../../../src/modules/crm/leads/lead.entity';

/**
 * Aceptar una cotización no duplica la empresa de un prospecto ya convertido.
 *
 * Hay dos caminos para que un prospecto se vuelva empresa cliente, y hacen cosas distintas:
 *
 * - `POST /crm/leads/:id/convert` crea la empresa y nada más: sin contrato ni presupuesto de UD.
 * - `POST /catalog/quotes/:id/accept` crea la empresa **y** su contrato con el precio del mes **y**
 *   el presupuesto de UD calculado desde los servicios cotizados.
 *
 * El del CRM comprobaba si el prospecto ya estaba convertido y respondía 409. El de la cotización
 * no, así que convertir primero y aceptar después creaba una segunda empresa para el mismo
 * restaurante: la primera quedaba huérfana —el lead ya apuntaba a la nueva— y el contrato colgaba
 * de la segunda. Nada fallaba; la cartera se duplicaba en silencio.
 *
 * No se alcanzaba porque aceptar una cotización era sólo de Desarrollo. Al liberar Catálogo los
 * dos caminos coexisten, y de ahí esta prueba.
 */
function servicio(lead: Partial<Lead>, empresaExistente?: Partial<Client>) {
  const guardados: Array<{ entidad: unknown; fila: any }> = [];
  const manager = {
    findOne: vi.fn(async (entidad: unknown) => {
      if (entidad === Lead) return { ...lead };
      if (entidad === Client) return empresaExistente ? { ...empresaExistente } : null;
      return null;
    }),
    find: vi.fn(async () => []),
    create: vi.fn((_entidad: unknown, fila: any) => ({ id: 'empresa-nueva', ...fila })),
    save: vi.fn(async (entidad: unknown, fila: any) => { guardados.push({ entidad, fila }); return fila; }),
  };
  const quote = {
    id: 'q1', status: QuoteStatus.SENT, leadId: lead.id, clientId: null,
    amount: 800000, title: 'Plan mensual', items: [], notes: null,
  };
  const quotes = {
    findOne: vi.fn(async () => quote),
    manager: { transaction: (cb: any) => cb(manager) },
  };
  const service = new QuotesService(
    quotes as never, {} as never, {} as never, {} as never, {} as never,
    { emit: vi.fn() } as never,
  );
  return { service, manager, guardados, quote };
}

describe('aceptar una cotización de un prospecto ya convertido', () => {
  it('reusa la empresa que ya existe en vez de crear otra', async () => {
    const { service, manager, guardados } = servicio(
      { id: 'lead-1', name: 'Casa Costanera', convertedToClientId: 'empresa-a' },
      { id: 'empresa-a', organizationId: 'org-1', name: 'Casa Costanera' },
    );

    const resultado = await service.accept('q1', 'org-1', 'usuario-1');

    expect(resultado.client.id).toBe('empresa-a');
    // Lo que importa: ninguna empresa nueva. `create(Client, …)` no se llamó.
    expect(manager.create.mock.calls.filter((llamada) => llamada[0] === Client)).toHaveLength(0);
    // Y el contrato queda colgando de la que ya existía, no de una segunda.
    const contrato = guardados.find((guardado) => guardado.entidad === Contract);
    expect(contrato?.fila.clientId).toBe('empresa-a');
  });

  it('crea la empresa cuando el prospecto no estaba convertido', async () => {
    const { service, manager } = servicio({ id: 'lead-1', name: 'Bar Ruperto', convertedToClientId: null });

    const resultado = await service.accept('q1', 'org-1', 'usuario-1');

    expect(resultado.client.id).toBe('empresa-nueva');
    expect(manager.create.mock.calls.filter((llamada) => llamada[0] === Client)).toHaveLength(1);
  });

  /**
   * Aceptar también califica el prospecto.
   *
   * El camino del CRM escribe `fitStatus` y éste no lo hacía, así que un prospecto cerrado
   * aceptando su cotización —que es como cierra el equipo comercial— quedaba vendido y «pendiente
   * de revisar» a la vez, y aparecía en la bandeja de los que falta calificar.
   */
  it('deja el prospecto vendido y calificado, no pendiente de revisar', async () => {
    const { service, guardados } = servicio({ id: 'lead-1', name: 'Bar Ruperto', convertedToClientId: null });

    await service.accept('q1', 'org-1', 'usuario-1');

    const lead = guardados.find((guardado) => guardado.entidad === Lead);
    expect(lead?.fila.fitStatus).toBe('sold');
    expect(lead?.fila.convertedToClientId).toBe('empresa-nueva');
  });
});
