import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../../../modules/clients/client.entity';
import { ClientStatus } from '../../../modules/clients/client-status.enum';
import { DesignBudgetService } from '../../../modules/design-budget/design-budget.service';
import { AccountCyclesService } from '../../../modules/account-cycles/account-cycles.service';

@Injectable()
export class CreateMonthlyCyclesJob {
  private readonly logger = new Logger(CreateMonthlyCyclesJob.name);

  constructor(
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    private readonly budgets: DesignBudgetService,
    private readonly cycles: AccountCyclesService,
  ) {}

  async handle(): Promise<void> {
    this.logger.log('Creating monthly account cycles...');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const activeClients = await this.clientRepo.find({
      where: { status: ClientStatus.ACTIVE },
    });

    let created = 0;
    // try/catch per client: one client with bad/missing data must not abort the
    // whole run and leave every client after it without a cycle for this month.
    for (const client of activeClients) {
      try {
        await this.cycles.ensure(client.organizationId, client.id, year, month);
        const before = await this.budgets.findMonthlyBudget(client.id, year, month);
        if (before) continue;
        await this.budgets.ensureMonthlyBudget(client.id, year, month);
        created++;
      } catch (error) {
        this.logger.error(`Failed to create monthly cycle for client ${client.id}: ${error instanceof Error ? error.message : error}`);
      }
    }

    this.logger.log(`Created ${created} UD budgets for ${year}-${month}`);
  }
}
