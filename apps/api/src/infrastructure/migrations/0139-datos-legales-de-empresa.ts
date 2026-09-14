import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Datos legales una vez por empresa: RUT, correo para ejercer derechos y enlaces de privacidad y
 * condiciones. Cada sucursal los usa sin repetirlos; lo que ya esté cargado en una sucursal sigue
 * mandando sobre esto. Columnas nuevas y vacías: no cambia nada de lo existente.
 */
export class DatosLegalesDeEmpresa1789500000000 implements MigrationInterface {
  name = 'DatosLegalesDeEmpresa1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnas: Array<[string, number]> = [['tax_id', 30], ['privacy_email', 190], ['privacy_url', 500], ['terms_url', 500], ['legal_mode', 10]];
    for (const [nombre, largo] of columnas) {
      if (!(await queryRunner.hasColumn('clients', nombre))) {
        await queryRunner.addColumn('clients', new TableColumn({ name: nombre, type: 'varchar', length: String(largo), isNullable: true }));
      }
    }
    // Textos propios de privacidad y condiciones, para mostrarlos dentro de la página en vez de enlazar.
    for (const nombre of ['privacy_text', 'terms_text']) {
      if (!(await queryRunner.hasColumn('clients', nombre))) {
        await queryRunner.addColumn('clients', new TableColumn({ name: nombre, type: 'text', isNullable: true }));
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const nombre of ['terms_text', 'privacy_text', 'legal_mode', 'terms_url', 'privacy_url', 'privacy_email', 'tax_id']) {
      if (await queryRunner.hasColumn('clients', nombre)) await queryRunner.dropColumn('clients', nombre);
    }
  }
}
