"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const user_entity_1 = require("./user.entity");
const users_controller_1 = require("./users.controller");
const create_user_use_case_1 = require("./create-user.use-case");
const list_users_use_case_1 = require("./list-users.use-case");
const update_user_use_case_1 = require("./update-user.use-case");
const client_entity_1 = require("../clients/client.entity");
const reset_user_password_use_case_1 = require("./reset-user-password.use-case");
const email_module_1 = require("../../core/notifications/email.module");
let UsersModule = class UsersModule {
};
exports.UsersModule = UsersModule;
exports.UsersModule = UsersModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, client_entity_1.Client]), email_module_1.EmailModule],
        controllers: [users_controller_1.UsersController],
        providers: [create_user_use_case_1.CreateUserUseCase, list_users_use_case_1.ListUsersUseCase, update_user_use_case_1.UpdateUserUseCase, reset_user_password_use_case_1.ResetUserPasswordUseCase],
        exports: [typeorm_1.TypeOrmModule],
    })
], UsersModule);
