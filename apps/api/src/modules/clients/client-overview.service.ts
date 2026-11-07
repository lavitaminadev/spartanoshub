import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Client } from './client.entity';
import { efectoEnElDisponible } from '../design-budget/ud-movement-effect';
import { normalizeClientCapabilities } from './client-capabilities';

export interface ClientOverviewStats {
  client: Client;
  /**
   * Las cifras de los módulos que **esta empresa** tiene contratados.
   *
   * Las claves de un módulo sin contratar no viajan, y por eso son opcionales. Antes viajaban
   * todas: la ficha de un local sin Producción recibía su recuento de piezas y la pantalla lo
   * escondía por su cuenta, de modo que la reja quedaba sólo en el navegador. Ausente no es cero
   * —cero es «contratado y sin movimiento»—, así que la pantalla puede decir cuál de las dos es.
   */
  stats: {
    pendingPieces?: number;
    contentGrids?: number;
    meetings?: number;
    upcomingMeetings?: number;
    documents?: number;
    reservationForms: number;
    publishedForms: number;
    contracts?: number;
    activeContracts?: number;
    briefs?: number;
    approvedBriefs?: number;
  };
  ud: {
    contracted: number;
    reserved: number;
    consumed: number;
  };
  /**
   * En qué se fueron las UD del mes, lo más reciente primero.
   *
   * El mismo libro que el portal muestra a la empresa, con una diferencia: acá viaja **quién lo
   * hizo**. Para la empresa el reparto interno no significa nada; para quien lleva la cuenta es
   * justo la pregunta que sigue cuando el total no cuadra con lo que esperaba.
   *
   * Vacío cuando el mes no tiene presupuesto abierto, que no es lo mismo que no haber movido
   * nada: eso lo dice `ud.contracted` en cero.
   */
  udMovements: Array<{
    date: string;
    type: string;
    /** Efecto en lo disponible, con signo: negativo descuenta, positivo suma. Sale del tipo. */
    units: number;
    piece: string | null;
    reason: string | null;
    actor: string | null;
  }>;
  pieceStatuses: Array<{ status: string; total: number }>;
  recentPieces: any[];
  recentMeetings: any[];
}

/**
 * Qué capacidad contratada gobierna cada cifra de la ficha.
 *
 * Los formularios de reserva se quedan fuera a propósito: Reservas es un servicio que nace
 * **encendido**, y la ficha de una empresa sin él igual tiene que poder decir que no tiene
 * ninguno publicado.
 */
const CAPACIDAD_DE_LA_CIFRA = {
  pendingPieces: 'production',
  contentGrids: 'content',
  meetings: 'meetings',
  upcomingMeetings: 'meetings',
  documents: 'documents',
  contracts: 'contracts',
  activeContracts: 'contracts',
  briefs: 'briefs',
  approvedBriefs: 'briefs',
} as const;

/**
 * Lee una columna construida con JSON_OBJECT/JSON_ARRAYAGG.
 *
 * Segun la version del driver y del motor, una misma consulta devuelve estas columnas ya
 * deserializadas o como texto. Acepta ambas formas y trata como vacio el JSON invalido,
 * porque un resumen incompleto es preferible a que la ficha del cliente no cargue.
 */
function readJsonColumn(value: unknown): any {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

@Injectable()
export class ClientOverviewService {
  constructor(
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    private readonly dataSource: DataSource,
  ) {}

  async getOverview(clientId: string, organizationId: string): Promise<ClientOverviewStats> {
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new Error('Client not found');

    // Query 1: todas las agregaciones de una vez
    const statsResult = await this.dataSource.query(`
      SELECT
        (SELECT JSON_OBJECT('pieces', (
          SELECT JSON_ARRAYAGG(JSON_OBJECT('status', grouped.status, 'total', grouped.total))
          FROM (
            SELECT status, COUNT(*) AS total
            FROM pieces WHERE organization_id = ? AND client_id = ? GROUP BY status
          ) AS grouped
        ))) AS piece_data,
        (SELECT COUNT(*) FROM content_grids WHERE organization_id = ? AND client_id = ?) AS content_grids,
        (SELECT COUNT(*) FROM meetings WHERE organization_id = ? AND client_id = ?) AS meetings_total,
        (SELECT COUNT(*) FROM meetings WHERE organization_id = ? AND client_id = ? AND scheduled_at >= NOW()) AS upcoming_meetings,
        (SELECT COUNT(*) FROM documents WHERE organization_id = ? AND client_id = ?) AS documents,
        (SELECT COUNT(*) FROM reservation_forms WHERE organization_id = ? AND client_id = ?) AS forms_total,
        (SELECT COUNT(*) FROM reservation_forms WHERE organization_id = ? AND client_id = ? AND status = 'published') AS forms_published,
        (SELECT COUNT(*) FROM contracts WHERE organization_id = ? AND client_id = ?) AS contracts_total,
        (SELECT COUNT(*) FROM contracts WHERE organization_id = ? AND client_id = ? AND status = 'active') AS contracts_active,
        (SELECT COUNT(*) FROM briefs WHERE organization_id = ? AND client_id = ?) AS briefs_total,
        (SELECT COUNT(*) FROM briefs WHERE organization_id = ? AND client_id = ? AND status = 'approved') AS briefs_approved,
        (SELECT JSON_OBJECT('contracted', COALESCE(SUM(contracted), 0), 'reserved', COALESCE(SUM(reserved), 0), 'consumed', COALESCE(SUM(consumed), 0))
         FROM ud_budgets WHERE client_id = ? AND year = YEAR(NOW()) AND month = MONTH(NOW())) AS ud_data
    `, [
      organizationId, clientId,  // piece_data
      organizationId, clientId,  // content_grids
      organizationId, clientId, organizationId, clientId,  // meetings
      organizationId, clientId,  // documents
      organizationId, clientId, organizationId, clientId,  // forms
      organizationId, clientId, organizationId, clientId,  // contracts
      organizationId, clientId, organizationId, clientId,  // briefs
      clientId,  // ud_data
    ]);

    // Query 2: items recientes
    const [recentPieces, recentMeetings, udMovementRows] = await Promise.all([
      this.dataSource.query(
        'SELECT id, title, status, deadline_at AS deadlineAt, ud_amount AS udAmount FROM pieces WHERE organization_id = ? AND client_id = ? ORDER BY updated_at DESC LIMIT 5',
        [organizationId, clientId],
      ),
      this.dataSource.query(
        'SELECT id, title, type, status, scheduled_at AS scheduledAt FROM meetings WHERE organization_id = ? AND client_id = ? ORDER BY scheduled_at DESC LIMIT 5',
        [organizationId, clientId],
      ),
      /*
       * El libro de UD del mes en curso.
       *
       * Se une al presupuesto del mes en vez de filtrar por la fecha del movimiento: un ajuste
       * escrito el día 1 pertenece al mes del presupuesto que toca, y no al mes natural en que
       * alguien lo registró. Es el mismo criterio con el que el motor reserva y consume.
       */
      this.dataSource.query(
        `SELECT m.created_at AS date, m.type, m.amount, m.reason, p.title AS piece, u.name AS actor
           FROM ud_movements m
           JOIN ud_budgets b ON b.id = m.ud_budget_id
           LEFT JOIN pieces p ON p.id = m.piece_id
           LEFT JOIN users u ON u.id = m.actor_id
          WHERE b.client_id = ? AND b.year = YEAR(NOW()) AND b.month = MONTH(NOW())
          ORDER BY m.created_at DESC
          LIMIT 50`,
        [clientId],
      ),
    ]);

    const statsRow = statsResult[0];
    const pieceStatuses = readJsonColumn(statsRow.piece_data)?.pieces || [];
    const udData = readJsonColumn(statsRow.ud_data) || {};

    const pendingPieces = pieceStatuses.reduce((sum: number, row: any) =>
      ['delivered', 'cancelled'].includes(row.status) ? sum : sum + row.total, 0);

    /*
     * Se borra lo que esta empresa no contrató, en vez de no haberlo consultado.
     *
     * Las once cifras salen de una sola consulta con subconsultas, y partirla por capacidad la
     * volvería a armar en código por cada combinación posible. Costar una subconsulta de más es
     * más barato que eso; lo que no puede pasar es que el dato salga del servidor.
     */
    const stats: ClientOverviewStats['stats'] = {
      pendingPieces,
      contentGrids: Number(statsRow.content_grids ?? 0),
      meetings: Number(statsRow.meetings_total ?? 0),
      upcomingMeetings: Number(statsRow.upcoming_meetings ?? 0),
      documents: Number(statsRow.documents ?? 0),
      reservationForms: Number(statsRow.forms_total ?? 0),
      publishedForms: Number(statsRow.forms_published ?? 0),
      contracts: Number(statsRow.contracts_total ?? 0),
      activeContracts: Number(statsRow.contracts_active ?? 0),
      briefs: Number(statsRow.briefs_total ?? 0),
      approvedBriefs: Number(statsRow.briefs_approved ?? 0),
    };
    const contratado = normalizeClientCapabilities(client.capabilities);
    for (const [cifra, capacidad] of Object.entries(CAPACIDAD_DE_LA_CIFRA)) {
      if (!contratado[capacidad]) delete stats[cifra as keyof typeof stats];
    }

    return {
      client,
      stats,
      ud: {
        contracted: Number(udData.contracted ?? 0),
        reserved: Number(udData.reserved ?? 0),
        consumed: Number(udData.consumed ?? 0),
      },
      udMovements: (udMovementRows as any[]).map((row) => ({
        date: row.date,
        type: String(row.type),
        units: efectoEnElDisponible(String(row.type), Number(row.amount)),
        piece: row.piece ?? null,
        reason: row.reason ?? null,
        actor: row.actor ?? null,
      })),
      pieceStatuses: pieceStatuses.map((row: any) => ({ status: row.status, total: row.total })),
      recentPieces,
      recentMeetings,
    };
  }
}
