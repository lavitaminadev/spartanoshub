import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renombra el origen de los leads nacidos de una reserva.
 *
 * El valor viaja guardado en `leads.source` y se compara literalmente para separar audiencia de
 * prospectos comerciales, así que cambiarlo solo en el código dejaría a los registros existentes
 * fuera de esa clasificación: las reservas anteriores desaparecerían de la pestaña de contactos
 * y, al no reconocerse como audiencia, volverían a entrar al embudo de ventas.
 *
 * `contacts.source` recibe el mismo tratamiento cuando existe, porque `LeadIntakeService` copia
 * ahí el origen al crear el contacto de audiencia.
 *
 * La reversión devuelve exactamente las filas que esta migración cambió: ambos valores son
 * literales fijos, no hay solapamiento posible con otro origen.
 */
export class ReservationLeadSourceRename1726900000000 implements MigrationInterface {
  name = 'ReservationLeadSourceRename1726900000000';

  private static readonly PREVIOUS = 'vitahub_reservations';
  private static readonly CURRENT = 'espartanos_reservations';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await ReservationLeadSourceRename1726900000000.rewrite(
      queryRunner,
      ReservationLeadSourceRename1726900000000.PREVIOUS,
      ReservationLeadSourceRename1726900000000.CURRENT,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await ReservationLeadSourceRename1726900000000.rewrite(
      queryRunner,
      ReservationLeadSourceRename1726900000000.CURRENT,
      ReservationLeadSourceRename1726900000000.PREVIOUS,
    );
  }

  /** Reescribe el origen en las tablas que lo guardan, saltando las que aún no existen. */
  private static async rewrite(queryRunner: QueryRunner, from: string, to: string): Promise<void> {
    for (const table of ['leads', 'contacts'] as const) {
      if (!(await queryRunner.hasTable(table))) continue;
      if (!(await queryRunner.hasColumn(table, 'source'))) continue;
      await queryRunner.query(`UPDATE ${table} SET source = ? WHERE source = ?`, [to, from]);
    }
  }
}
