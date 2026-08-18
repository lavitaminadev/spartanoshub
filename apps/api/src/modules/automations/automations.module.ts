import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Automation } from './automation.entity';
import { AutomationRun } from './automation-run.entity';
import { AutomationRunStep } from './automation-run-step.entity';
import { AutomationsService } from './automations.service';
import { AutomationsController } from './automations.controller';
import { AutomationRunnerService } from './automation-runner.service';
import { AutomationActionsService } from './automation-actions.service';
import { AutomationTriggerListener } from './automation-trigger.listener';
import { AutomationScheduleJob } from './automation-schedule.job';
import { WebhookDelivery } from './webhook-delivery.entity';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { HttpModule } from '@nestjs/axios';
import { NotificationsModule } from '../../core/notifications/notifications.module';
import { EmailModule } from '../../core/notifications/email.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { ContractsModule } from '../contracts/contracts.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { Opportunity } from '../crm/opportunities/opportunity.entity';
import { Lead } from '../crm/leads/lead.entity';
import { User } from '../users/user.entity';
import { ApprovalRequest } from '../approvals/approval-request.entity';

/**
 * Motor de automatizaciones.
 *
 * No confundir con `ProcessTemplatesModule`, que administra plantillas de etapas de procesos
 * operativos y no ejecuta nada.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Automation, AutomationRun, AutomationRunStep, Opportunity, Lead, User, ApprovalRequest, WebhookDelivery]),
    NotificationsModule,
    EmailModule,
    CollaborationModule,
    ContractsModule,
    ApprovalsModule,
    HttpModule,
  ],
  controllers: [AutomationsController],
  providers: [AutomationsService, AutomationRunnerService, AutomationActionsService, AutomationTriggerListener, AutomationScheduleJob, WebhookDeliveryService],
  exports: [AutomationRunnerService, AutomationScheduleJob, WebhookDeliveryService],
})
export class AutomationsModule {}
