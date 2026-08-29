import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Qué recordatorio ya se mandó de cada tarea.
 *
 * Los avisos previos a un vencimiento son dos —doce horas antes y tres horas antes— y el trabajo
 * que los manda corre cada media hora. Sin dejar constancia de lo enviado, cada pasada volvería a
 * mandar el mismo correo: veinticuatro copias del recordatorio de las doce horas antes de que
 * llegue el de las tres.
 *
 * Guarda el último mandado y no una marca de tiempo: lo que hay que saber es «¿ya avisé del de 3
 * horas?», y una fecha obliga a reconstruir esa respuesta en cada comparación.
 */
export class RecordatorioDeTarea1756600000000 implements MigrationInterface {
  name = 'RecordatorioDeTarea1756600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'approval_requests'
        AND column_name = 'reminder_sent'
    `);
    if (Number(columnas?.[0]?.n ?? 0) > 0) return;

    await queryRunner.query("ALTER TABLE approval_requests ADD COLUMN reminder_sent VARCHAR(10) NULL");

    /*
     * El trabajo pregunta «qué vence pronto y sigue abierto».
     *
     * Ya existe un índice por `kind`, `status` y `due_at`, que es exactamente esa consulta, así
     * que no se añade otro: un índice de más encarece cada escritura para acelerar una lectura
     * que ya era rápida.
     */
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'approval_requests'
        AND column_name = 'reminder_sent'
    `);
    if (Number(columnas?.[0]?.n ?? 0) === 0) return;

    await queryRunner.query('ALTER TABLE approval_requests DROP COLUMN reminder_sent');
  }
}
