"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const google_oauth_service_1 = require("./google-oauth.service");
const google_controller_1 = require("./google.controller");
const integration_entity_1 = require("../integration.entity");
const integration_account_entity_1 = require("../integration-account.entity");
const integration_metric_entity_1 = require("../integration-metric.entity");
const google_data_service_1 = require("./google-data.service");
const google_calendar_service_1 = require("./google-calendar.service");
const client_entity_1 = require("../../clients/client.entity");
const google_conversions_service_1 = require("./google-conversions.service");
const google_conversion_outbox_entity_1 = require("./google-conversion-outbox.entity");
const google_conversion_outbox_service_1 = require("./google-conversion-outbox.service");
let GoogleModule = class GoogleModule {
};
exports.GoogleModule = GoogleModule;
exports.GoogleModule = GoogleModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([integration_entity_1.Integration, integration_account_entity_1.IntegrationAccount, integration_metric_entity_1.IntegrationMetric, client_entity_1.Client, google_conversion_outbox_entity_1.GoogleConversionOutbox])],
        controllers: [google_controller_1.GoogleController],
        providers: [google_oauth_service_1.GoogleOAuthService, google_data_service_1.GoogleDataService, google_calendar_service_1.GoogleCalendarService, google_conversions_service_1.GoogleConversionsService, google_conversion_outbox_service_1.GoogleConversionOutboxService],
        exports: [google_oauth_service_1.GoogleOAuthService, google_calendar_service_1.GoogleCalendarService, google_conversions_service_1.GoogleConversionsService, google_conversion_outbox_service_1.GoogleConversionOutboxService],
    })
], GoogleModule);
//# sourceMappingURL=google.module.js.map