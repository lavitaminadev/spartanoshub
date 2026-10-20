import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * Caducidad de lo prestado y bajas de correo que se levantan sin perder la constancia.
 *
 * - `user_client_access` y `user_action_overrides` ganan `expires_at`: lo prestado caduca solo. Las
 *   filas existentes quedan sin fecha, que es lo que ya eran; prestar sin fecha sigue siendo válido.
 *   `expiry_notified_at` marca que ya se avisó a quien lo concedió, para no repetir el aviso.
 * - `email_suppression` deja de borrarse al levantarse: `activa` pasa a falso y quedan la fecha, el
 *   origen y las veces que se levantó. Las filas existentes quedan activas.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class CaducidadDeLoPrestadoYBajasConConstancia1790000000183 implements MigrationInterface {
  name = 'CaducidadDeLoPrestadoYBajasConConstancia1790000000183';

  private static readonly COLUMNAS: Array<[string, string, string]> = [
    ['user_client_access', 'expires_at', 'TIMESTAMP NULL'],
    ['user_client_access', 'expiry_notified_at', 'TIMESTAMP NULL'],
    ['user_action_overrides', 'expires_at', 'TIMESTAMP NULL'],
    ['user_action_overrides', 'expiry_notified_at', 'TIMESTAMP NULL'],
    ['email_suppression', 'activa', 'TINYINT(1) NOT NULL DEFAULT 1'],
    ['email_suppression', 'levantada_el', 'DATETIME NULL'],
    ['email_suppression', 'levantada_origen', 'VARCHAR(80) NULL'],
    ['email_suppression', 'veces_levantada', 'SMALLINT NOT NULL DEFAULT 0'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [tabla, columna, tipo] of CaducidadDeLoPrestadoYBajasConConstancia1790000000183.COLUMNAS) {
      if (!(await queryRunner.hasTable(tabla))) continue;
      if (!(await hayColumna(queryRunner, tabla, columna))) {
        await queryRunner.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${tipo}`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [tabla, columna] of [...CaducidadDeLoPrestadoYBajasConConstancia1790000000183.COLUMNAS].reverse()) {
      if (await queryRunner.hasTable(tabla) && await hayColumna(queryRunner, tabla, columna)) {
        await queryRunner.query(`ALTER TABLE ${tabla} DROP COLUMN ${columna}`);
      }
    }
  }
}
