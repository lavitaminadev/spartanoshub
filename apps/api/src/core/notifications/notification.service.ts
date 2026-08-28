import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { User } from '../../modules/users/user.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification) private repo: Repository<Notification>,
  ) {}

  async notifyUser(
    organizationId: string,
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<Notification> {
    const notif = this.repo.create({ organizationId, userId, type, title, message, data });
    return this.repo.save(notif);
  }

  async notifyRole(
    orgId: string,
    role: string,
    type: string,
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<Notification[]> {
    const userRepo = this.repo.manager.getRepository(User);
    const users = await userRepo.find({
      where: { organizationId: orgId, role, isActive: true } as any,
    });
    return this.notifyMultiple(
      orgId,
      users.map((u) => u.id),
      type, title, message, data,
    );
  }

  async notifyMultiple(
    organizationId: string,
    userIds: string[],
    type: string,
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<Notification[]> {
    const notifs = userIds.map((userId) =>
      this.repo.create({ organizationId, userId, type, title, message, data }),
    );
    return this.repo.save(notifs);
  }

  async findByUser(organizationId: string, userId: string, includeSystem = true): Promise<Notification[]> {
    return this.repo.find({
      where: includeSystem ? { organizationId, userId } : { organizationId, userId, type: Not('system') },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markAsRead(organizationId: string, id: string, userId: string, includeSystem = true): Promise<Notification | null> {
    const notif = await this.repo.findOne({ where: includeSystem ? { organizationId, id, userId } : { organizationId, id, userId, type: Not('system') } });
    if (!notif) return null;
    notif.read = true;
    return this.repo.save(notif);
  }

  async unreadCount(organizationId: string, userId: string, includeSystem = true): Promise<number> {
    return this.repo.count({ where: includeSystem ? { organizationId, userId, read: false } : { organizationId, userId, read: false, type: Not('system') } });
  }

  async markAllAsRead(organizationId: string, userId: string, includeSystem = true): Promise<{ updated: number }> {
    const result = await this.repo.update(includeSystem ? { organizationId, userId, read: false } : { organizationId, userId, read: false, type: Not('system') }, { read: true });
    return { updated: result.affected ?? 0 };
  }
  /**
   * Borra una notificación de esa persona.
   *
   * Marcar leída y borrar son cosas distintas: leída baja el contador, pero la fila sigue en la
   * lista para siempre. Sin poder borrarlas, el panel se convierte en un archivo que nadie puede
   * limpiar y se deja de mirar, que es la forma silenciosa de que las notificaciones dejen de
   * servir.
   *
   * Acotado a : son suyas, y nadie borra las de otro.
   *
   * @returns Si había algo que borrar.
   */
  async remove(organizationId: string, id: string, userId: string): Promise<boolean> {
    const result = await this.repo.delete({ organizationId, id, userId });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Borra todas las leídas de esa persona.
   *
   * Las no leídas se conservan a propósito: vaciar de un golpe algo que todavía no se miró es
   * perder avisos sin saber cuáles eran.
   *
   * @returns Cuántas se borraron.
   */
  async removeRead(organizationId: string, userId: string): Promise<{ deleted: number }> {
    const result = await this.repo.delete({ organizationId, userId, read: true });
    return { deleted: result.affected ?? 0 };
  }
}
