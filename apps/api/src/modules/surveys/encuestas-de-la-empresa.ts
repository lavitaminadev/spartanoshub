/**
 * @fileoverview Si una empresa tiene Encuestas contratado.
 *
 * Es la misma reja que CRM y Reservas: la capacidad de la empresa dice si el servicio existe
 * para ella, y el permiso de cada persona dice qué puede hacer dentro. Una encuesta interna
 * (sin empresa) no depende de ninguna capacidad.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { normalizeClientCapabilities } from '../clients/client-capabilities';

interface ConsultaSql { query(sql: string, parametros?: unknown[]): Promise<unknown> }

export async function encuestasHabilitadas(db: ConsultaSql, clientId: string | null | undefined): Promise<boolean> {
  if (!clientId) return true;
  const filas = await db.query('SELECT capabilities FROM clients WHERE id = ? LIMIT 1', [clientId]) as Array<{ capabilities?: unknown }>;
  const cruda = filas?.[0]?.capabilities;
  let valor: Record<string, boolean> | null = null;
  try { valor = typeof cruda === 'string' ? JSON.parse(cruda) : (cruda as Record<string, boolean> | null) ?? null; } catch { valor = null; }
  return normalizeClientCapabilities(valor).surveys;
}

/** Para el panel: rechaza operar encuestas de una empresa que no tiene el servicio. */
export async function exigirEncuestasHabilitadas(db: ConsultaSql, clientId: string | null | undefined): Promise<void> {
  if (!(await encuestasHabilitadas(db, clientId))) throw new ForbiddenException('Encuestas no está habilitado para esta empresa');
}

/** Para lo público: una encuesta de una empresa sin el servicio simplemente no está disponible. */
export async function encuestaPublicaDisponible(db: ConsultaSql, clientId: string | null | undefined): Promise<void> {
  if (!(await encuestasHabilitadas(db, clientId))) throw new NotFoundException('La encuesta no está disponible');
}
