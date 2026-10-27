import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NivelDeDatosService } from './nivel-de-datos.service';
import { PerfilAsignacion } from '../../modules/users/perfiles/perfil-asignacion.entity';
import { PerfilDeEmpresa } from '../../modules/users/perfiles/perfil-de-empresa.entity';
import { UsersModule } from '../../modules/users/users.module';

/**
 * El servicio que decide cuánto ve cada persona, con sus dependencias en un solo sitio.
 *
 * Lo consumen cuatro módulos —Reservas, CRM, Encuestas y Marketing— y antes cada uno lo declaraba
 * como proveedor suyo. Eso compila: lo que no compila es que falte un repositorio, y entonces la
 * aplicación no arranca y el fallo aparece lejos de su causa. Aquí las dependencias se declaran
 * una vez y los cuatro importan el módulo.
 */
@Module({
  imports: [TypeOrmModule.forFeature([PerfilAsignacion, PerfilDeEmpresa]), UsersModule],
  providers: [NivelDeDatosService],
  exports: [NivelDeDatosService],
})
export class NivelDeDatosModule {}
