import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Momento en que una solicitud queda aceptada.
 *
 * Las solicitudes ya registraban `reviewed_at` y `resolved_at`, pero no el paso intermedio.
 * Sin esta marca el ciclo se mide en dos tramos —abierta hasta revisada, y revisada hasta
 * resuelta— y el segundo mezcla dos cosas distintas: lo que tardó Operaciones en decidir y lo
 * que tardó el área en convertirla en trabajo. Son responsables distintos y se corrigen de
 * forma distinta, así que separarlos es la diferencia entre un dato accionable y un promedio.
 *
 * Guarda el dato, no la regla: cuánto puede tardar cada tramo y si eso es un compromiso o una
 * estimación lo define Operaciones. Registrarlo desde ahora evita que el tiempo que pase hasta
 * esa definición quede sin medir, porque es tiempo que no se recupera hacia atrás.
 */
export class WorkRequestAcceptedAt1726900004000 implements MigrationInterface {
  name = 'WorkRequestAcceptedAt1726900004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('work_requests', 'accepted_at')) return;
    await queryRunner.addColumn(
      'work_requests',
      new TableColumn({ name: 'accepted_at', type: 'timestamp', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('work_requests', 'accepted_at')) {
      await queryRunner.dropColumn('work_requests', 'accepted_at');
    }
  }
}
