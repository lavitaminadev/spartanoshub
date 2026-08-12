"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationContext = void 0;
const async_hooks_1 = require("async_hooks");
exports.organizationContext = new async_hooks_1.AsyncLocalStorage();
