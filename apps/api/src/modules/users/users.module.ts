import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { AdministracionDelEquipoService } from './administracion-del-equipo.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { CreateUserUseCase } from './create-user.use-case';
import { ListUsersUseCase } from './list-users.use-case';
import { UpdateUserUseCase } from './update-user.use-case';
import { Client } from '../clients/client.entity';
import { ResetUserPasswordUseCase } from './reset-user-password.use-case';
import { EmailModule } from '../../core/notifications/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Client]), EmailModule, AuthorizationModule],
  controllers: [UsersController],
  providers: [CreateUserUseCase, ListUsersUseCase, UpdateUserUseCase, ResetUserPasswordUseCase, AdministracionDelEquipoService],
  exports: [TypeOrmModule],
})
export class UsersModule {}
