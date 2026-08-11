"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_entity_1 = require("./notification.entity");
const user_entity_1 = require("../../modules/users/user.entity");
let NotificationService = class NotificationService {
    constructor(repo) {
        this.repo = repo;
    }
    async notifyUser(organizationId, userId, type, title, message, data) {
        const notif = this.repo.create({ organizationId, userId, type, title, message, data });
        return this.repo.save(notif);
    }
    async notifyRole(orgId, role, type, title, message, data) {
        const userRepo = this.repo.manager.getRepository(user_entity_1.User);
        const users = await userRepo.find({
            where: { organizationId: orgId, role, isActive: true },
        });
        return this.notifyMultiple(orgId, users.map((u) => u.id), type, title, message, data);
    }
    async notifyMultiple(organizationId, userIds, type, title, message, data) {
        const notifs = userIds.map((userId) => this.repo.create({ organizationId, userId, type, title, message, data }));
        return this.repo.save(notifs);
    }
    async findByUser(organizationId, userId, includeSystem = true) {
        return this.repo.find({
            where: includeSystem ? { organizationId, userId } : { organizationId, userId, type: (0, typeorm_2.Not)('system') },
            order: { createdAt: 'DESC' },
            take: 50,
        });
    }
    async markAsRead(organizationId, id, userId, includeSystem = true) {
        const notif = await this.repo.findOne({ where: includeSystem ? { organizationId, id, userId } : { organizationId, id, userId, type: (0, typeorm_2.Not)('system') } });
        if (!notif)
            return null;
        notif.read = true;
        return this.repo.save(notif);
    }
    async unreadCount(organizationId, userId, includeSystem = true) {
        return this.repo.count({ where: includeSystem ? { organizationId, userId, read: false } : { organizationId, userId, read: false, type: (0, typeorm_2.Not)('system') } });
    }
    async markAllAsRead(organizationId, userId, includeSystem = true) {
        const result = await this.repo.update(includeSystem ? { organizationId, userId, read: false } : { organizationId, userId, read: false, type: (0, typeorm_2.Not)('system') }, { read: true });
        return { updated: result.affected ?? 0 };
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], NotificationService);
//# sourceMappingURL=notification.service.js.map