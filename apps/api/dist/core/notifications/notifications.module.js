"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const notification_entity_1 = require("./notification.entity");
const notification_service_1 = require("./notification.service");
const notifications_controller_1 = require("./notifications.controller");
const email_module_1 = require("./email.module");
const destinatario_de_avisos_entity_1 = require("./destinatario-de-avisos.entity");
const destinatarios_de_avisos_service_1 = require("./destinatarios-de-avisos.service");
const destinatarios_de_avisos_controller_1 = require("./destinatarios-de-avisos.controller");
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([notification_entity_1.Notification, destinatario_de_avisos_entity_1.DestinatarioDeAvisos]), email_module_1.EmailModule],
        controllers: [notifications_controller_1.NotificationsController, destinatarios_de_avisos_controller_1.DestinatariosDeAvisosController],
        providers: [notification_service_1.NotificationService, destinatarios_de_avisos_service_1.DestinatariosDeAvisosService],
        exports: [notification_service_1.NotificationService, destinatarios_de_avisos_service_1.DestinatariosDeAvisosService, typeorm_1.TypeOrmModule, email_module_1.EmailModule],
    })
], NotificationsModule);
