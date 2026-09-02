import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Invoice } from '../../../modules/billing/invoice.entity';
import { Client } from '../../../modules/clients/client.entity';
import { EmailService } from '../../notifications/email.service';
import { ParameterResolver } from '../../parameters/parameter-resolver.service';
import { componerCorreo } from '../../notifications/plantilla-de-correo';

@Injectable()
export class CollectionEmailsJob {
  private readonly logger = new Logger(CollectionEmailsJob.name);

  constructor(
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    private emailService: EmailService,
    private readonly parametros: ParameterResolver,
  ) {}

  async handle(): Promise<void> {
    this.logger.log('Processing overdue invoices...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueInvoices = await this.invoiceRepo.find({
      where: { status: 'pending', dueAt: LessThan(today) },
      relations: ['client'],
    });

    let sent = 0;
    for (const invoice of overdueInvoices) {
      try {
        const client = invoice.client;
        if (!client) {
          this.logger.warn(`Invoice ${invoice.number} has no associated client, skipping`);
          continue;
        }

        const email = await this.resolveClientEmail(client.id);
        if (!email) {
          this.logger.warn(`Client ${client.id} has no email, skipping invoice ${invoice.number}`);
          continue;
        }

        const dueDateStr = invoice.dueAt instanceof Date
          ? invoice.dueAt.toISOString().split('T')[0]
          : String(invoice.dueAt);

        // La cobranza ya era automática; este interruptor permite pausarla por empresa sin
        // borrar la plantilla. El valor de fábrica es true para no cambiar los avisos vigentes.
        const enabled = await this.parametros.get(
          'email.collection_overdue_enabled', client.id, null, invoice.organizationId,
        );
        if (enabled !== true) continue;

        const [subjectTemplate, bodyTemplate] = await Promise.all([
          this.parametros.get('email.collection_overdue_subject', client.id, null, invoice.organizationId),
          this.parametros.get('email.collection_overdue_body', client.id, null, invoice.organizationId),
        ]);
        const monto = new Intl.NumberFormat('es-CL', {
          style: 'currency', currency: invoice.currency || client.currency || 'CLP',
          maximumFractionDigits: 0,
        }).format(Number(invoice.total));
        const { subject, html } = componerCorreo(
          String(subjectTemplate ?? 'Recordatorio de pago: factura {{factura}} vencida'),
          String(bodyTemplate ?? 'La factura {{factura}} de {{empresa}} venció el {{vencimiento}}.'),
          { empresa: client.name, factura: invoice.number, monto, vencimiento: dueDateStr },
        );

        const delivered = await this.emailService.send(email, subject, html);

        // Only flip to 'overdue' once the email actually goes out. This job only
        // ever queries status:'pending' — marking it 'overdue' unconditionally on
        // a failed delivery meant a transient email failure permanently stopped
        // retries for that invoice.
        if (delivered) {
          invoice.status = 'overdue';
          await this.invoiceRepo.save(invoice);
          sent++;
          this.logger.log(`Collection email accepted for invoice ${invoice.number}`);
        } else {
          this.logger.warn(`Collection email was not delivered for invoice ${invoice.number}; will retry next run`);
        }
      } catch (error) {
        this.logger.error(`Failed to process overdue invoice ${invoice.number}: ${error instanceof Error ? error.message : error}`);
      }
    }

    this.logger.log(`Processed ${overdueInvoices.length} overdue invoices, sent ${sent} emails`);
  }

  private async resolveClientEmail(clientId: string): Promise<string | null> {
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
      relations: ['lead'],
    });
    return client?.lead?.email ?? null;
  }
}
