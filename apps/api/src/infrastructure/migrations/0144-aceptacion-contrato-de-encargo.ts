import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * - Aceptación del contrato de encargo de tratamiento por cada empresa: qué versión, cuándo y quién.
 * - `reservations.sensitive_consent_at` / `sensitive_consent_text`: consentimiento expreso para
 *   información de salud o alimentación.
 *
 * Columnas nuevas y vacías: nada existente cambia.
 */
export class AceptacionContratoDeEncargo1790000000000 implements MigrationInterface {
  name = 'AceptacionContratoDeEncargo1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnas = [
      new TableColumn({ name: 'encargo_version', type: 'varchar', length: '40', isNullable: true }),
      new TableColumn({ name: 'encargo_accepted_at', type: 'timestamp', isNullable: true }),
      new TableColumn({ name: 'encargo_accepted_by', type: 'varchar', length: '36', isNullable: true }),
      new TableColumn({ name: 'encargo_accepted_name', type: 'varchar', length: '180', isNullable: true }),
    ];
    for (const columna of columnas) {
      if (!(await queryRunner.hasColumn('clients', columna.name))) await queryRunner.addColumn('clients', columna);
    }
    if (!(await queryRunner.hasColumn('reservations', 'sensitive_consent_at'))) {
      await queryRunner.addColumn('reservations', new TableColumn({ name: 'sensitive_consent_at', type: 'timestamp', isNullable: true }));
    }
    if (!(await queryRunner.hasColumn('reservations', 'sensitive_consent_text'))) {
      await queryRunner.addColumn('reservations', new TableColumn({ name: 'sensitive_consent_text', type: 'text', isNullable: true }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const columna of ['sensitive_consent_text', 'sensitive_consent_at']) {
      if (await queryRunner.hasColumn('reservations', columna)) await queryRunner.dropColumn('reservations', columna);
    }
    for (const columna of ['encargo_accepted_name', 'encargo_accepted_by', 'encargo_accepted_at', 'encargo_version']) {
      if (await queryRunner.hasColumn('clients', columna)) await queryRunner.dropColumn('clients', columna);
    }
  }
}
