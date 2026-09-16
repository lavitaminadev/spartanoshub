import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Deja rastro de cada tarea programada: cuándo corrió por última vez y cómo terminó.
 *
 * Hasta ahora el control de concurrencia era memoria del proceso, así que nada sobrevivía al
 * reinicio y la aplicación no podía responder «¿esto se está ejecutando?». Es la pregunta que
 * importa: el recordatorio de reserva y la encuesta después de la visita se pueden encender en
 * pantalla y no salir nunca porque nadie creó el cron, sin ningún error a la vista.
 *
 * Una fila por tarea, reescrita en cada corrida: interesa el estado actual, no el historial.
 */
export class RegistroDeTareasProgramadas1790000000145 implements MigrationInterface {
  name = 'RegistroDeTareasProgramadas1790000000145';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('cron_runs')) return;
    await queryRunner.createTable(new Table({
      name: 'cron_runs',
      columns: [
        { name: 'task', type: 'varchar', length: '80', isPrimary: true },
        { name: 'last_run_at', type: 'timestamp', isNullable: false },
        { name: 'ok', type: 'boolean', default: true },
        /** Resumen de la corrida o el mensaje del fallo, para diagnosticar sin abrir los registros. */
        { name: 'detail', type: 'varchar', length: '500', isNullable: true },
      ],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('cron_runs')) await queryRunner.dropTable('cron_runs');
  }
}
