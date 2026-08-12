"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientId = void 0;
const common_1 = require("@nestjs/common");
exports.ClientId = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.clientId || request.user?.clientId;
});
