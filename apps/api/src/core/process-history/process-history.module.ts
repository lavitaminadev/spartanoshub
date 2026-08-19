import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessHistoryService } from './process-history.service';
import { ProcessStageChange } from './process-stage-change.entity';

/**
 * Registro de recorrido, disponible para cualquier módulo que mueva algo de etapa.
 *
 * Es global porque lo usan tres módulos que no se conocen entre sí —solicitudes, producción y
 * aprobaciones— y la alternativa sería importarlo en cada uno y volver a importarlo en el
 * siguiente que aparezca. Un olvido ahí no rompe la compilación: deja un proceso sin historial
 * en silencio, que es justo el fallo que este módulo existe para evitar.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ProcessStageChange])],
  providers: [ProcessHistoryService],
  exports: [ProcessHistoryService],
})
export class ProcessHistoryModule {}
