import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientOverviewService } from '../../../src/modules/clients/client-overview.service';

/**
 * El resumen del cliente agrega las piezas por estado dentro de un JSON.
 *
 * MySQL/MariaDB rechaza anidar una funcion de agregacion dentro de otra (error 1111,
 * "Invalid use of group function"), asi que el conteo por estado tiene que resolverse en
 * una tabla derivada antes de envolverlo con JSON_ARRAYAGG.
 */
describe('ClientOverviewService', () => {
  /*
   * Con Producción contratada, porque de eso dependen las cifras de piezas.
   *
   * Las claves de un módulo sin contratar ya no viajan en el resumen. Sin esta capacidad el
   * recuento de pendientes no estaría —que es correcto— y estas pruebas, que son sobre cómo se
   * agrega el JSON, no podrían mirarlo.
   */
  const client = { id: 'client-1', organizationId: 'org-1', name: 'Acme', capabilities: { production: true } };
  let clients: { findOne: ReturnType<typeof vi.fn> };
  let dataSource: { query: ReturnType<typeof vi.fn> };

  function buildService(pieceData: string) {
    clients = { findOne: vi.fn().mockResolvedValue(client) };
    dataSource = {
      query: vi.fn()
        .mockResolvedValueOnce([{
          piece_data: pieceData,
          ud_data: JSON.stringify({ contracted: 10, reserved: 4, consumed: 2 }),
          content_grids: 3, meetings_total: 2, upcoming_meetings: 1, documents: 5,
          forms_total: 2, forms_published: 1, contracts_total: 1, contracts_active: 1,
          briefs_total: 4, briefs_approved: 2,
        }])
        .mockResolvedValue([]),
    };
    return new ClientOverviewService(clients as never, dataSource as never);
  }

  beforeEach(() => vi.clearAllMocks());

  it('agrega el conteo por estado en una tabla derivada, no dentro de JSON_ARRAYAGG', async () => {
    const service = buildService(JSON.stringify({ pieces: [{ status: 'backlog', total: 1 }] }));
    await service.getOverview('client-1', 'org-1');

    const sql: string = dataSource.query.mock.calls[0][0];
    const normalized = sql.replace(/\s+/g, ' ');
    expect(normalized).toContain('SELECT status, COUNT(*) AS total');
    expect(normalized).toContain(') AS grouped');
    // COUNT(*) nunca puede quedar dentro del JSON_OBJECT que envuelve JSON_ARRAYAGG.
    expect(normalized).not.toMatch(/JSON_ARRAYAGG\(JSON_OBJECT\([^)]*COUNT\(\*\)/);
  });

  it('suma como pendientes las piezas que no estan entregadas ni canceladas', async () => {
    const service = buildService(JSON.stringify({
      pieces: [
        { status: 'backlog', total: 1 },
        { status: 'in_progress', total: 2 },
        { status: 'delivered', total: 4 },
        { status: 'cancelled', total: 3 },
      ],
    }));

    const result = await service.getOverview('client-1', 'org-1');

    expect(result.stats.pendingPieces).toBe(3);
    expect(result.pieceStatuses).toHaveLength(4);
  });

  it('trata un cliente sin piezas como cero pendientes', async () => {
    // Sin filas agrupadas, JSON_ARRAYAGG devuelve NULL y el JSON queda {"pieces": null}.
    const service = buildService(JSON.stringify({ pieces: null }));

    const result = await service.getOverview('client-1', 'org-1');

    expect(result.stats.pendingPieces).toBe(0);
    expect(result.pieceStatuses).toEqual([]);
  });

  /**
   * Las cifras de un módulo sin contratar no salen del servidor.
   *
   * Antes salían todas y la ficha las escondía por su cuenta, de modo que la reja quedaba sólo en
   * el navegador: una empresa sin Producción recibía igual su recuento de piezas.
   *
   * Los formularios de reserva se quedan a propósito: Reservas nace encendido, y la ficha tiene
   * que poder decir que esa empresa no tiene ninguno publicado.
   */
  it('no entrega las cifras de los módulos que la empresa no contrató', async () => {
    const service = buildService(JSON.stringify({ pieces: [{ status: 'backlog', total: 1 }] }));
    clients.findOne.mockResolvedValue({ ...client, capabilities: {} });

    const result = await service.getOverview('client-1', 'org-1');

    for (const cifra of ['pendingPieces', 'contentGrids', 'meetings', 'upcomingMeetings', 'documents', 'contracts', 'activeContracts', 'briefs', 'approvedBriefs'] as const) {
      expect(result.stats[cifra], cifra).toBeUndefined();
    }
    expect(result.stats.publishedForms).toBe(1);
    expect(result.stats.reservationForms).toBe(2);
  });
});
