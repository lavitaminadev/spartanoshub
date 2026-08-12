"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const onboarding_entity_1 = require("../../modules/onboarding/onboarding.entity");
const notification_entity_1 = require("../notifications/notification.entity");
const piece_entity_1 = require("../../modules/production/piece.entity");
const piece_version_entity_1 = require("../../modules/production/piece-version.entity");
const client_entity_1 = require("../../modules/clients/client.entity");
const lead_entity_1 = require("../../modules/crm/leads/lead.entity");
const xp_event_entity_1 = require("../../modules/gamification/xp-event.entity");
const xp_period_entity_1 = require("../../modules/gamification/xp-period.entity");
const ud_budget_entity_1 = require("../../modules/design-budget/ud-budget.entity");
const ud_movement_entity_1 = require("../../modules/design-budget/ud-movement.entity");
const user_entity_1 = require("../../modules/users/user.entity");
const lead_converted_handler_1 = require("./handlers/lead-converted.handler");
const piece_delivered_handler_1 = require("./handlers/piece-delivered.handler");
const piece_assigned_handler_1 = require("./handlers/piece-assigned.handler");
const workflows_module_1 = require("../../modules/workflows/workflows.module");
const correction_entity_1 = require("../../modules/production/correction.entity");
const billing_module_1 = require("../../modules/billing/billing.module");
const piece_rejected_handler_1 = require("./handlers/piece-rejected.handler");
let EventsModule = class EventsModule {
};
exports.EventsModule = EventsModule;
exports.EventsModule = EventsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            core_1.DiscoveryModule,
            event_emitter_1.EventEmitterModule,
            typeorm_1.TypeOrmModule.forFeature([
                onboarding_entity_1.Onboarding, notification_entity_1.Notification, piece_entity_1.Piece, piece_version_entity_1.PieceVersion, client_entity_1.Client, lead_entity_1.Lead,
                xp_event_entity_1.XPEvent, xp_period_entity_1.XPPeriod, ud_budget_entity_1.UDBudget, ud_movement_entity_1.UDMovement, user_entity_1.User,
                correction_entity_1.Correction,
            ]),
            workflows_module_1.WorkflowsModule,
            billing_module_1.BillingModule,
        ],
        providers: [lead_converted_handler_1.LeadConvertedHandler, piece_delivered_handler_1.PieceDeliveredHandler, piece_assigned_handler_1.PieceAssignedHandler, piece_rejected_handler_1.PieceRejectedHandler],
        exports: [event_emitter_1.EventEmitterModule],
    })
], EventsModule);
