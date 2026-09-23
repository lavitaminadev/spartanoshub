import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { Organization } from '../../modules/organizations/organization.entity';
import { User } from '../../modules/users/user.entity';
import { Client } from '../../modules/clients/client.entity';
import { UserPermissionOverride } from './user-permission-override.entity';
import { RolePermissionOverride } from './role-permission-override.entity';
import { UserClientAccess } from '../client-scope/user-client-access.entity';
import { PermissionResolverService } from './permission-resolver.service';
import { PermissionGuard } from './permission.guard';
import { UserActionOverride } from './user-action-override.entity';
import { AccionesService } from './acciones.service';
import { AccionGuard } from './requiere-accion';
import { PermissionsController } from './permissions.controller';
import { AuditModule } from '../audit/audit.module';
import { ParametersModule } from '../parameters/parameters.module';

/**
 * Autorización por módulo: resolución de niveles, guard que la aplica y administración de
 * excepciones —tanto por módulo como por cuenta—.
 *
 * El guard se registra de forma global y niega los endpoints que no declaran módulo, de
 * modo que lo configurado en la pantalla de permisos es también lo que ocurre en la API.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, User, Client, UserPermissionOverride, RolePermissionOverride, UserClientAccess, UserActionOverride]),
    AuditModule,
    // Los ajustes preguntan permisos y los permisos leen ajustes: la referencia va diferida.
    forwardRef(() => ParametersModule),
  ],
  controllers: [PermissionsController],
  providers: [
    PermissionResolverService,
    AccionesService,
    { provide: APP_GUARD, useClass: PermissionGuard },
    // Después del de módulo: primero se entra al módulo, luego se puede o no hacer la acción.
    { provide: APP_GUARD, useClass: AccionGuard },
  ],
  exports: [PermissionResolverService, AccionesService, TypeOrmModule],
})
export class AuthorizationModule {}
