import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cuándo se le recordó a alguien su reserva.
 *
 * El trabajo que manda los recordatorios corre cada media hora y busca lo que ocurre dentro de un
 * plazo. Sin dejar constancia de lo enviado, cada pasada volvería a escribir a la misma persona:
 * cuarenta y ocho copias del mismo recordatorio antes de que llegue el día.
 *
 * Se guarda el instante y no un sí/no porque la anticipación es un ajuste: si mañana se cambia de
 * veinticuatro horas a cuarenta y ocho, la fecha permite saber si el que se mandó sigue valiendo.
 *
 * Va en `reservations` y no en una tabla aparte: es un dato de la reserva, tiene su misma vida y
 * desaparece con ella.
 */
export class RecordatorioDeReserva1757300000000 implements MigrationInterface {
  name = 'RecordatorioDeReserva1757300000000';

  private async falta(queryRunner: QueryRunner): Promise<boolean> {
    const filas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'reservations'
        AND column_name = 'reminder_sent_at'
    `);
    return Number(filas?.[0]?.n ?? 0) === 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.falta(queryRunner))) return;

    await queryRunner.query('ALTER TABLE reservations ADD COLUMN reminder_sent_at TIMESTAMP NULL');

    /*
     * El trabajo pregunta «qué empieza pronto, sigue en pie y no se ha recordado».
     *
     * `starts_at` ya está indexado para el listado, y es la columna que acota de verdad: las
     * reservas de las próximas horas son un puñado frente al histórico. Añadir un índice sobre
     * esta columna encarecería cada escritura para filtrar un conjunto que ya viene pequeño.
     */
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.falta(queryRunner)) return;
    await queryRunner.query('ALTER TABLE reservations DROP COLUMN reminder_sent_at');
  }
}
