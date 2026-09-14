import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Aceptación del uso de datos en respuestas de encuestas que piden nombre, RUT, correo o teléfono.
 *
 * Guarda cuándo se aceptó y el texto exacto aceptado. Columnas nuevas y vacías: las respuestas
 * existentes no cambian.
 */
export class AceptacionEnEncuestas1789600000000 implements MigrationInterface {
  name = 'AceptacionEnEncuestas1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('survey_responses', 'privacy_consent_at'))) {
      await queryRunner.addColumn('survey_responses', new TableColumn({ name: 'privacy_consent_at', type: 'timestamp', isNullable: true }));
    }
    if (!(await queryRunner.hasColumn('survey_responses', 'privacy_consent_text'))) {
      await queryRunner.addColumn('survey_responses', new TableColumn({ name: 'privacy_consent_text', type: 'text', isNullable: true }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const nombre of ['privacy_consent_text', 'privacy_consent_at']) {
      if (await queryRunner.hasColumn('survey_responses', nombre)) await queryRunner.dropColumn('survey_responses', nombre);
    }
  }
}
