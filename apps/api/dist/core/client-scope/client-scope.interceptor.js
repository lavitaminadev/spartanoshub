"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientScopeInterceptor = void 0;
const common_1 = require("@nestjs/common");
let ClientScopeInterceptor = class ClientScopeInterceptor {
    intercept(context, next) {
        const req = context.switchToHttp().getRequest();
        const user = req.user;
        if (user?.role === 'client' && user?.clientId) {
            req.clientId = user.clientId;
        }
        return next.handle();
    }
};
exports.ClientScopeInterceptor = ClientScopeInterceptor;
exports.ClientScopeInterceptor = ClientScopeInterceptor = __decorate([
    (0, common_1.Injectable)()
], ClientScopeInterceptor);
//# sourceMappingURL=client-scope.interceptor.js.map