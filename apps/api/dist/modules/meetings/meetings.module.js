"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const meeting_entity_1 = require("./meeting.entity");
const action_item_entity_1 = require("./action-item.entity");
const meetings_controller_1 = require("./meetings.controller");
const create_meeting_use_case_1 = require("./create-meeting.use-case");
const list_meetings_use_case_1 = require("./list-meetings.use-case");
const google_module_1 = require("../integrations/google/google.module");
const client_entity_1 = require("../clients/client.entity");
const user_entity_1 = require("../users/user.entity");
let MeetingsModule = class MeetingsModule {
};
exports.MeetingsModule = MeetingsModule;
exports.MeetingsModule = MeetingsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([meeting_entity_1.Meeting, action_item_entity_1.ActionItem, client_entity_1.Client, user_entity_1.User]), google_module_1.GoogleModule],
        controllers: [meetings_controller_1.MeetingsController],
        providers: [create_meeting_use_case_1.CreateMeetingUseCase, list_meetings_use_case_1.ListMeetingsUseCase],
    })
], MeetingsModule);
//# sourceMappingURL=meetings.module.js.map