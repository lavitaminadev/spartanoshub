import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmpresaInterceptor } from './empresa.interceptor';
import { Client } from '../../modules/clients/client.entity';
import { PodMember } from '../../modules/pods/pod-member.entity';
import { AccountAccessService } from './account-access.service';
import { ClientCapabilityService } from './client-capability.service';
import { UserClientAccess } from './user-client-access.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Client, PodMember, UserClientAccess])],
  providers: [
    AccountAccessService,
    ClientCapabilityService,
    /*
     * Global y en este módulo: resolver sobre qué empresa va la petición tiene que pasar en
     * todas, no en las que se acuerden de pedirlo. Se registra aquí, donde vive el servicio de
     * alcance del que depende, en vez de en `app.module.ts`.
     */
    { provide: APP_INTERCEPTOR, useClass: EmpresaInterceptor },
  ],
  exports: [AccountAccessService, ClientCapabilityService],
})
export class AccountAccessModule {}
