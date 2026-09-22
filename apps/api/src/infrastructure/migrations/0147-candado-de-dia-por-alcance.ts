import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * El candado de día deja de ser siempre por cliente y pasa a declarar su alcance.
 *
 * La tabla nació cuando una cuenta era un local: bloquear `(cliente, día)` no le quitaba turno a
 * nadie. Con varias reservas publicadas por la misma empresa, cada alta de cualquiera de ellas
 * espera a las demás del mismo día aunque no compitan por ningún cupo, porque el candado se toma
 * siempre, tenga o no la empresa un tope diario que proteger.
 *
 * `scope_id` guarda el cliente cuando hay un tope de empresa que cubrir —y entonces se comporta
 * exactamente como antes— o el formulario cuando no lo hay, que es el caso en que no existe
 * ninguna cuenta compartida que dos altas puedan pasarse.
 *
 * Los valores que ya estaban son identificadores de cliente y siguen siendo válidos: la columna
 * cambia de nombre y de significado, no de contenido. La tabla no guarda cuentas —sólo existe
 * para tener algo concreto que bloquear—, así que ninguna fila queda mal.
 */
export class CandadoDeDiaPorAlcance1790000000147 implements MigrationInterface {
  name = 'CandadoDeDiaPorAlcance1790000000147';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservation_day_locks'))) return;
    const tabla = await queryRunner.getTable('reservation_day_locks');
    if (tabla?.findColumnByName('scope_id')) return;

    // El índice único se recrea después: renombrar la columna con el índice encima funciona en
    // MariaDB, pero dejarlo explícito evita depender de ese detalle del motor.
    if (tabla?.indices.some((indice) => indice.name === 'UQ_reservation_day_lock')) {
      await queryRunner.dropIndex('reservation_day_locks', 'UQ_reservation_day_lock');
    }
    await queryRunner.query('ALTER TABLE `reservation_day_locks` CHANGE `client_id` `scope_id` VARCHAR(36) NOT NULL');
    await queryRunner.createIndex('reservation_day_locks', new TableIndex({
      name: 'UQ_reservation_day_lock', columnNames: ['scope_id', 'day'], isUnique: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservation_day_locks'))) return;
    const tabla = await queryRunner.getTable('reservation_day_locks');
    if (!tabla?.findColumnByName('scope_id')) return;

    if (tabla.indices.some((indice) => indice.name === 'UQ_reservation_day_lock')) {
      await queryRunner.dropIndex('reservation_day_locks', 'UQ_reservation_day_lock');
    }
    // Las filas de alcance formulario no son identificadores de cliente: se descartan, porque la
    // tabla sólo sostiene candados vivos dentro de una transacción.
    await queryRunner.query('ALTER TABLE `reservation_day_locks` CHANGE `scope_id` `client_id` VARCHAR(36) NOT NULL');
    await queryRunner.createIndex('reservation_day_locks', new TableIndex({
      name: 'UQ_reservation_day_lock', columnNames: ['client_id', 'day'], isUnique: true,
    }));
  }
}
