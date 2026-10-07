import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParameterDefinition } from '../parameters/parameter-definition.entity';
import { ParameterValue } from '../parameters/parameter-value.entity';
import { ParameterResolver } from '../parameters/parameter-resolver.service';
import { EmailService } from './email.service';
import { MarcaDeLaEmpresaService } from './marca-de-la-empresa.service';
import { RegistroDeCorreo } from './registro-de-correo.entity';
import { RegistroDeCorreosController } from './registro-de-correos.controller';

/*
 * El lector de parámetros va declarado acá y no importado del módulo de parámetros.
 *
 * Los correos de acceso —contraseña temporal, recuperar la cuenta— leen su plantilla, y el módulo
 * de parámetros ya importa este: importarlo de vuelta formaría un ciclo que Nest resuelve mal. Es
 * una segunda instancia del mismo lector, con su propia caché corta; lee las mismas tablas.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ParameterDefinition, ParameterValue, RegistroDeCorreo])],
  controllers: [RegistroDeCorreosController],
  providers: [EmailService, ParameterResolver, MarcaDeLaEmpresaService],
  exports: [EmailService, MarcaDeLaEmpresaService],
})
export class EmailModule {}
