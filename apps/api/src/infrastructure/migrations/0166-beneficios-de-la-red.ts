import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * El permiso para recibir beneficios de los **demás** locales, con su propio registro.
 *
 * Antes viajaba dentro de la casilla de beneficios del local: el texto decía «de este local y sus
 * locales» y quedaba un único `marketing_consent_at`. Con eso no se podía demostrar cuál de los dos
 * permisos había dado la persona, ni retirar uno sin el otro, que es justo lo que la ley exige.
 *
 * No convierte nada de lo antiguo: una reserva vieja conserva el texto que realmente se mostró, y
 * deducir de él un permiso de red que nadie marcó por separado sería inventar consentimiento.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class BeneficiosDeLaRed1790000000166 implements MigrationInterface {
  name = 'BeneficiosDeLaRed1790000000166';

  private readonly columnas: Array<[string, string]> = [
    ['group_marketing_consent_at', 'TIMESTAMP NULL'],
    ['group_marketing_consent_version', 'VARCHAR(30) NULL'],
    ['group_marketing_consent_text', 'TEXT NULL'],
  ];

  /**
   * La solicitud de grupo lo guarda igual, sin versión: hereda el texto a la reserva al convertirse
   * y es ahí donde el registro tiene que quedar completo.
   */
  private readonly enSolicitudes: string[] = ['group_marketing_consent_at', 'group_marketing_consent_text'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('reservations')) {
      for (const [columna, tipo] of this.columnas) {
        if (!(await hayColumna(queryRunner, 'reservations', columna))) {
          await queryRunner.query(`ALTER TABLE reservations ADD COLUMN ${columna} ${tipo}`);
        }
      }
    }
    if (await queryRunner.hasTable('reservation_group_requests')) {
      for (const columna of this.enSolicitudes) {
        if (!(await hayColumna(queryRunner, 'reservation_group_requests', columna))) {
          const tipo = this.columnas.find(([nombre]) => nombre === columna)![1];
          await queryRunner.query(`ALTER TABLE reservation_group_requests ADD COLUMN ${columna} ${tipo}`);
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of ['reservation_group_requests', 'reservations']) {
      if (!(await queryRunner.hasTable(tabla))) continue;
      for (const [columna] of [...this.columnas].reverse()) {
        if (await hayColumna(queryRunner, tabla, columna)) {
          await queryRunner.query(`ALTER TABLE ${tabla} DROP COLUMN ${columna}`);
        }
      }
    }
  }
}
