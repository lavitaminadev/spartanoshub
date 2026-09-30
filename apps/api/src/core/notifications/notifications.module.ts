import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { EmailModule } from './email.module';
import { DestinatarioDeAvisos } from './destinatario-de-avisos.entity';
import { DestinatariosDeAvisosService } from './destinatarios-de-avisos.service';
import { DestinatariosDeAvisosController } from './destinatarios-de-avisos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, DestinatarioDeAvisos]), EmailModule],
  controllers: [NotificationsController, DestinatariosDeAvisosController],
  providers: [NotificationService, DestinatariosDeAvisosService],
  exports: [NotificationService, DestinatariosDeAvisosService, TypeOrmModule, EmailModule],
})
export class NotificationsModule {}
