"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborationModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const process_comment_entity_1 = require("./process-comment.entity");
const process_comments_service_1 = require("./process-comments.service");
const process_comments_controller_1 = require("./process-comments.controller");
const audit_module_1 = require("../../core/audit/audit.module");
let CollaborationModule = class CollaborationModule {
};
exports.CollaborationModule = CollaborationModule;
exports.CollaborationModule = CollaborationModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([process_comment_entity_1.ProcessComment]), audit_module_1.AuditModule],
        controllers: [process_comments_controller_1.PieceCommentsController, process_comments_controller_1.SessionCommentsController, process_comments_controller_1.WorkRequestCommentsController],
        providers: [process_comments_service_1.ProcessCommentsService],
        exports: [process_comments_service_1.ProcessCommentsService],
    })
], CollaborationModule);
