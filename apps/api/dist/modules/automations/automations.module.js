"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const automation_entity_1 = require("./automation.entity");
const automation_run_entity_1 = require("./automation-run.entity");
const automation_run_step_entity_1 = require("./automation-run-step.entity");
const automations_service_1 = require("./automations.service");
const automations_controller_1 = require("./automations.controller");
const automation_runner_service_1 = require("./automation-runner.service");
const automation_actions_service_1 = require("./automation-actions.service");
const automation_trigger_listener_1 = require("./automation-trigger.listener");
const automation_schedule_job_1 = require("./automation-schedule.job");
const webhook_delivery_entity_1 = require("./webhook-delivery.entity");
const webhook_delivery_service_1 = require("./webhook-delivery.service");
const axios_1 = require("@nestjs/axios");
const notifications_module_1 = require("../../core/notifications/notifications.module");
const email_module_1 = require("../../core/notifications/email.module");
const collaboration_module_1 = require("../collaboration/collaboration.module");
const contracts_module_1 = require("../contracts/contracts.module");
const approvals_module_1 = require("../approvals/approvals.module");
const opportunity_entity_1 = require("../crm/opportunities/opportunity.entity");
const lead_entity_1 = require("../crm/leads/lead.entity");
const user_entity_1 = require("../users/user.entity");
const approval_request_entity_1 = require("../approvals/approval-request.entity");
let AutomationsModule = class AutomationsModule {
};
exports.AutomationsModule = AutomationsModule;
exports.AutomationsModule = AutomationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([automation_entity_1.Automation, automation_run_entity_1.AutomationRun, automation_run_step_entity_1.AutomationRunStep, opportunity_entity_1.Opportunity, lead_entity_1.Lead, user_entity_1.User, approval_request_entity_1.ApprovalRequest, webhook_delivery_entity_1.WebhookDelivery]),
            notifications_module_1.NotificationsModule,
            email_module_1.EmailModule,
            collaboration_module_1.CollaborationModule,
            contracts_module_1.ContractsModule,
            approvals_module_1.ApprovalsModule,
            axios_1.HttpModule,
        ],
        controllers: [automations_controller_1.AutomationsController],
        providers: [automations_service_1.AutomationsService, automation_runner_service_1.AutomationRunnerService, automation_actions_service_1.AutomationActionsService, automation_trigger_listener_1.AutomationTriggerListener, automation_schedule_job_1.AutomationScheduleJob, webhook_delivery_service_1.WebhookDeliveryService],
        exports: [automation_runner_service_1.AutomationRunnerService, automation_schedule_job_1.AutomationScheduleJob, webhook_delivery_service_1.WebhookDeliveryService],
    })
], AutomationsModule);
