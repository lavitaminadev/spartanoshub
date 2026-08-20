import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './lead.entity';
import { LeadStatus } from './lead-status.enum';

/** Una fila de conteo por clave, ya normalizada a número. */
export interface ConteoPorClave { key: string; total: number }

/**
 * Cifras del embudo para un período.
 *
 * Todas se calculan sobre `leads` y ninguna sobre un contador acumulado aparte: un contador se
 * desincroniza en cuanto alguien corrige un dato a mano, y entonces el panel y la lista dicen
 * cosas distintas sin que nada falle.
 */
@Injectable()
export class CrmDashboardService {
  constructor(@InjectRepository(Lead) private readonly leads: Repository<Lead>) {}

  /**
   * @param days - Ventana en días. Se acota en el controlador; acá se asume ya validada.
   */
  async dashboard(organizationId: string, days: number) {
    const desde = new Date(Date.now() - days * 86_400_000);
    const base = { organizationId, domain: 'commercial' };

    const [total, calificados, conVisita, ventas, porEtapa, porFuente, porDia, motivos] = await Promise.all([
      this.leads.count({ where: { ...base } as never }),
      this.leads.count({ where: { ...base, status: LeadStatus.QUOTE_SENT } as never }),
      this.leads.count({ where: { ...base, status: LeadStatus.MEETING_SCHEDULED } as never }),
      this.leads.count({ where: { ...base, status: LeadStatus.WON } as never }),
      this.agrupar(organizationId, 'status'),
      this.agrupar(organizationId, 'source'),
      this.porDia(organizationId, desde),
      this.agrupar(organizationId, 'discard_reason', LeadStatus.LOST),
    ]);

    return {
      days,
      totals: {
        leads: total,
        // Se envía el conteo y no el porcentaje: la pantalla decide cómo redondearlo, y calcular
        // acá obligaría a mandar también el divisor para que pudiera explicarlo.
        calificados,
        conVisita,
        ventas,
      },
      porEtapa,
      porFuente,
      porDia,
      motivosDeCierre: motivos,
    };
  }

  /**
   * Cuenta leads agrupados por una columna.
   *
   * El nombre de columna no viene de fuera: son tres valores fijos escritos acá. Interpolar uno
   * recibido por la API sería inyección de SQL, y `createQueryBuilder` no parametriza nombres de
   * columna, solo valores.
   */
  private async agrupar(organizationId: string, columna: 'status' | 'source' | 'discard_reason', status?: LeadStatus) {
    const query = this.leads.createQueryBuilder('lead')
      .select(`lead.${columna}`, 'key')
      .addSelect('COUNT(*)', 'total')
      .where('lead.organization_id = :organizationId', { organizationId })
      .andWhere('lead.domain = :domain', { domain: 'commercial' })
      .groupBy(`lead.${columna}`);

    if (status) query.andWhere('lead.status = :status', { status });

    const filas = await query.getRawMany<{ key: string | null; total: string }>();
    return filas
      .filter((fila) => fila.key)
      .map((fila) => ({ key: fila.key!, total: Number(fila.total) }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Leads por día dentro de la ventana.
   *
   * Devuelve solo los días con al menos uno. Rellenar los vacíos es trabajo de la pantalla, que
   * es la que sabe cuántos puntos caben en el ancho disponible.
   */
  private async porDia(organizationId: string, desde: Date): Promise<ConteoPorClave[]> {
    const filas = await this.leads.createQueryBuilder('lead')
      .select('DATE(lead.created_at)', 'key')
      .addSelect('COUNT(*)', 'total')
      .where('lead.organization_id = :organizationId', { organizationId })
      .andWhere('lead.domain = :domain', { domain: 'commercial' })
      .andWhere('lead.created_at >= :desde', { desde })
      .groupBy('DATE(lead.created_at)')
      .orderBy('DATE(lead.created_at)', 'ASC')
      .getRawMany<{ key: string; total: string }>();

    return filas.map((fila) => ({ key: String(fila.key), total: Number(fila.total) }));
  }
}
