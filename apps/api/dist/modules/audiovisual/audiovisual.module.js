"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudiovisualModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const moodboard_entity_1 = require("./moodboard.entity");
const session_entity_1 = require("./session.entity");
const audiovisual_controller_1 = require("./audiovisual.controller");
const audiovisual_service_1 = require("./audiovisual.service");
const client_entity_1 = require("../clients/client.entity");
const user_entity_1 = require("../users/user.entity");
let AudiovisualModule = class AudiovisualModule {
};
exports.AudiovisualModule = AudiovisualModule;
exports.AudiovisualModule = AudiovisualModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([moodboard_entity_1.Moodboard, session_entity_1.Session, client_entity_1.Client, user_entity_1.User])],
        controllers: [audiovisual_controller_1.AudiovisualController],
        providers: [audiovisual_service_1.AudiovisualService],
    })
], AudiovisualModule);
