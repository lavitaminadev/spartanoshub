import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { MonthlyReport } from './monthly-report.entity';
import { GenerateMonthlyReportDto, UpdateMonthlyReportDto } from './dto/monthly-report.dto';
import { metricasDelPeriodo, rangoDeComparacion, rangoDelMes, type ModoDeComparacion } from './metricas-del-periodo';

@Injectable()
export class MonthlyReportsService {
  constructor(
    @InjectRepository(MonthlyReport) private readonly reports: Repository<MonthlyReport>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async list(organizationId: string, options: { clientId?: string; clientIds?: string[]; clientView?: boolean; year?: number; month?: number }) {
    const where: FindOptionsWhere<MonthlyReport> = { organizationId };
    if (options.clientId) where.clientId = options.clientId;
    else if (options.clientIds !== undefined) where.clientId = In(options.clientIds.length ? options.clientIds : ['00000000-0000-0000-0000-000000000000']);
    if (options.clientView) where.status = 'published';
    if (options.year) where.year = options.year;
    if (options.month) where.month = options.month;
    const reports = await this.reports.find({ where, order: { year: 'DESC', month: 'DESC' } });
    const clientIds = [...new Set(reports.map((report) => report.clientId))];
    const clients = clientIds.length ? await this.clients.find({ where: { organizationId, id: In(clientIds) } }) : [];
    const clientMap = new Map(clients.map((client) => [client.id, client.name]));
    return reports.map((report) => ({ ...report, clientName: clientMap.get(report.clientId) ?? 'Cliente' }));
  }

  /**
   * Mide un rango libre y, si se pide, el rango con que se compara.
   *
   * No guarda nada. El informe mensual es el documento que se redacta y se firma; esto es la
   * pregunta suelta —«¿cómo nos fue del 12 de marzo al 4 de abril?»— que antes no se podía hacer
   * sin esperar al cierre del mes. Comparten `metricasDelPeriodo`, de modo que preguntar acá por
   * un mes completo da exactamente las cifras del informe de ese mes.
   *
   * @param allowedClientIds - Cuentas que alcanza quien consulta; `undefined` es sin límite. Una
   * empresa fuera del alcance responde 404 y no 403: decir «existe pero no es tuya» ya revela a
   * quién atiende la agencia.
   */
  async explorar(
    organizationId: string,
    clientId: string,
    desde: string,
    hasta: string,
    comparar: ModoDeComparacion,
    allowedClientIds?: string[],
  ) {
    if (allowedClientIds !== undefined && !allowedClientIds.includes(clientId)) {
      throw new NotFoundException('Cliente no encontrado');
    }
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      throw new BadRequestException('Las fechas van en formato AAAA-MM-DD');
    }
    if (hasta <= desde) throw new BadRequestException('El fin del rango debe ser posterior al inicio');
    const referencia = rangoDeComparacion(desde, hasta, comparar);
    const [periodo, previo] = await Promise.all([
      metricasDelPeriodo(this.dataSource, organizationId, clientId, desde, hasta),
      referencia ? metricasDelPeriodo(this.dataSource, organizationId, clientId, referencia.desde, referencia.hasta) : Promise.resolve(null),
    ]);
    return { clientId, clientName: client.name, comparar, periodo, comparacion: previo };
  }

  async generate(organizationId: string, userId: string, dto: GenerateMonthlyReportDto): Promise<MonthlyReport> {
    const client = await this.clients.findOne({ where: { id: dto.clientId, organizationId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    const existing = await this.reports.findOne({ where: { organizationId, clientId: dto.clientId, year: dto.year, month: dto.month } });
    if (existing?.status === 'published') throw new BadRequestException('El reporte publicado debe volver a borrador antes de regenerarse');
    /*
     * El mes se mide con la misma función que el explorador, y se compara contra el mes anterior.
     *
     * Antes los cinco agregados vivían acá escritos a mano. Compartirlos es lo que garantiza que el
     * informe publicado de marzo y el explorador consultado sobre marzo digan la misma cifra: con
     * dos copias, basta que una cambie para que no haya forma de saber cuál miente.
     */
    const { desde, hasta } = rangoDelMes(dto.year, dto.month);
    const anterior = rangoDeComparacion(desde, hasta, 'anterior')!;
    const [periodo, previo] = await Promise.all([
      metricasDelPeriodo(this.dataSource, organizationId, dto.clientId, desde, hasta),
      metricasDelPeriodo(this.dataSource, organizationId, dto.clientId, anterior.desde, anterior.hasta),
    ]);
    const metrics = periodo.metricas;
    const report = existing ?? this.reports.create({ organizationId, clientId: client.id, year: dto.year, month: dto.month, createdBy: userId });
    Object.assign(report, {
      title: `Resultados ${client.name} · ${String(dto.month).padStart(2, '0')}/${dto.year}`,
      status: 'draft', metrics, adSpend: periodo.inversion, leads: metrics.leads, bookings: metrics.bookings, conversions: metrics.conversions,
      salesGenerated: periodo.ventas,
      metricsPrevious: previo.metricas,
      previousPeriodStart: previo.desde,
      executiveSummary: report.executiveSummary || `Durante el período se registraron ${metrics.leads} leads, ${metrics.bookings} reservas y ${metrics.conversions} conversiones atribuidas.`,
      insights: report.insights ?? [],
    });
    return this.reports.save(report);
  }

  /**
   * Edita el contenido redactado de un reporte en borrador.
   *
   * @param allowedClientIds - Cuentas que alcanza quien edita; `undefined` significa sin
   * límite. El reporte debe pertenecer a una de ellas: el título, el resumen ejecutivo y las
   * recomendaciones son el relato que la agencia le entrega a un cliente concreto, y quien no
   * lleva esa cuenta no tiene por qué reescribirlo.
   */
  async update(id: string, organizationId: string, dto: UpdateMonthlyReportDto, allowedClientIds?: string[]): Promise<MonthlyReport> {
    const report = await this.find(id, organizationId, allowedClientIds);
    if (report.status === 'published') throw new BadRequestException('Devuelve el reporte a borrador antes de editarlo');
    Object.assign(report, dto);
    if (dto.title !== undefined) report.title = dto.title.trim();
    if (dto.executiveSummary !== undefined) report.executiveSummary = dto.executiveSummary.trim() || undefined;
    if (dto.recommendations !== undefined) report.recommendations = dto.recommendations.trim() || undefined;
    if (dto.insights !== undefined) report.insights = dto.insights.map((value) => value.trim()).filter(Boolean);
    return this.reports.save(report);
  }

  async setPublished(id: string, organizationId: string, userId: string, published: boolean): Promise<MonthlyReport> {
    const report = await this.find(id, organizationId);
    report.status = published ? 'published' : 'draft';
    report.publishedAt = published ? new Date() : undefined;
    report.publishedBy = published ? userId : undefined;
    await this.dataSource.query('UPDATE account_cycles SET report_status = ? WHERE organization_id = ? AND client_id = ? AND year = ? AND month = ?', [published ? 'completed' : 'in_progress', organizationId, report.clientId, report.year, report.month]);
    return this.reports.save(report);
  }

  /**
   * Recupera un reporte de la organización, opcionalmente acotado a un conjunto de cuentas.
   *
   * Responde 404 y no 403 cuando el reporte existe pero queda fuera del alcance: distinguir
   * ambos casos ya revela qué clientes tiene la agencia y en qué meses les reporta.
   *
   * @param allowedClientIds - Cuentas que alcanza quien consulta; `undefined` significa sin
   * límite y un arreglo vacío significa ninguna.
   */
  private async find(id: string, organizationId: string, allowedClientIds?: string[]) {
    const report = await this.reports.findOne({ where: { id, organizationId } });
    if (!report) throw new NotFoundException('Reporte mensual no encontrado');
    if (allowedClientIds !== undefined && !allowedClientIds.includes(report.clientId)) {
      throw new NotFoundException('Reporte mensual no encontrado');
    }
    return report;
  }
}
