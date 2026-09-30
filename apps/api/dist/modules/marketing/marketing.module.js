"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const suscriptor_entity_1 = require("./suscriptor.entity");
const exclusion_entity_1 = require("./exclusion.entity");
const campana_entity_1 = require("./campana.entity");
const reservation_coupon_entity_1 = require("../reservations/domain/reservation-coupon.entity");
const user_entity_1 = require("../users/user.entity");
const envio_de_campana_entity_1 = require("./envio-de-campana.entity");
const suscriptores_service_1 = require("./suscriptores.service");
const suscriptores_controller_1 = require("./suscriptores.controller");
const campanas_service_1 = require("./campanas.service");
const envios_de_campana_service_1 = require("./envios-de-campana.service");
const campanas_controller_1 = require("./campanas.controller");
const alta_desde_reserva_1 = require("./alta-desde-reserva");
const account_access_module_1 = require("../../core/client-scope/account-access.module");
const email_module_1 = require("../../core/notifications/email.module");
const parameters_module_1 = require("../../core/parameters/parameters.module");
let MarketingModule = class MarketingModule {
};
exports.MarketingModule = MarketingModule;
exports.MarketingModule = MarketingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([suscriptor_entity_1.Suscriptor, exclusion_entity_1.ExclusionDeCorreo, campana_entity_1.Campana, envio_de_campana_entity_1.EnvioDeCampana, reservation_coupon_entity_1.ReservationCoupon, user_entity_1.User]),
            account_access_module_1.AccountAccessModule,
            email_module_1.EmailModule,
            parameters_module_1.ParametersModule,
        ],
        controllers: [suscriptores_controller_1.SuscriptoresController, campanas_controller_1.CampanasController],
        providers: [suscriptores_service_1.SuscriptoresService, alta_desde_reserva_1.AltaDeSuscriptorDesdeReserva, campanas_service_1.CampanasService, envios_de_campana_service_1.EnviosDeCampanaService],
        exports: [suscriptores_service_1.SuscriptoresService, alta_desde_reserva_1.AltaDeSuscriptorDesdeReserva, campanas_service_1.CampanasService, envios_de_campana_service_1.EnviosDeCampanaService],
    })
], MarketingModule);
