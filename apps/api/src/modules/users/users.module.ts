import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { UserPermissionOverride } from '../../core/authorization/user-permission-override.entity';
import { AdministradoresDeEmpresaService } from './administradores-de-empresa.service';
import { AccountAccessModule } from '../../core/client-scope/account-access.module';
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
import { AuditModule } from '../../core/audit/audit.module';
import { NotificationsModule } from '../../core/notifications/notifications.module';
import { UserClientAccess } from '../../core/client-scope/user-client-access.entity';
import { ConsentVersion } from '../../core/data-protection/consent-version.entity';
import { DataConsent } from '../../core/data-protection/consent.entity';
import { PerfilDeEmpresa } from './perfiles/perfil-de-empresa.entity';
import { PerfilAsignacion } from './perfiles/perfil-asignacion.entity';
import { InvitacionDeEquipo } from './perfiles/invitacion-de-equipo.entity';
import { PerfilesService } from './perfiles/perfiles.service';
import { InvitacionesService } from './perfiles/invitaciones.service';
import { PerfilesController } from './perfiles/perfiles.controller';
import { InvitacionesPublicasController } from './perfiles/invitaciones-publicas.controller';
import { EmailModule } from '../../core/notifications/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Client, UserPermissionOverride, UserClientAccess, ConsentVersion, DataConsent, PerfilDeEmpresa, PerfilAsignacion, InvitacionDeEquipo]), EmailModule, NotificationsModule, AuditModule, AuthorizationModule, AccountAccessModule],
  controllers: [UsersController, PerfilesController, InvitacionesPublicasController],
  providers: [CreateUserUseCase, ListUsersUseCase, UpdateUserUseCase, ResetUserPasswordUseCase, AdministracionDelEquipoService, AdministradoresDeEmpresaService, PerfilesService, InvitacionesService],
  exports: [TypeOrmModule, AdministradoresDeEmpresaService, PerfilesService],
})
export class UsersModule {}
