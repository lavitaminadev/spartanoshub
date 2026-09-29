import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * Las excepciones que repartió una cuenta de empresa quedan en su empresa.
 *
 * Quien administra el equipo de su empresa reparte accesos dentro de ella. La pantalla, sin
 * embargo, las guardaba sin empresa, y una excepción sin empresa vale en **todas** las de esa
 * persona: dar CRM a alguien en el local propio se lo daba también en el otro local que atiende,
 * que quien lo concedió no administra. El servidor ya no lo permite; esto arregla lo guardado.
 *
 * Sólo se tocan las que concedió una cuenta de empresa. Esa cuenta sólo podía repartir a gente
 * de su propia empresa, así que la empresa de destino es la de la cuenta de quien la recibe: se
 * reescribe exactamente la intención con que se dio. Las que concedió la agencia no se tocan:
 * ahí «en todas sus empresas» era una opción que se elegía a propósito.
 *
 * Si ya había una excepción de esa misma empresa, esa manda y la general sobra: se retira en vez
 * de chocar contra la clave única. Correrla dos veces no cambia el resultado.
 */
export class PermisosDelPortalEnSuEmpresa1790000000160 implements MigrationInterface {
  name = 'PermisosDelPortalEnSuEmpresa1790000000160';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_permission_overrides'))) return;
    if (!(await hayColumna(queryRunner, 'user_permission_overrides', 'client_id'))) return;

    // Las generales que ya tienen su versión en esa empresa: la de la empresa manda, esta sobra.
    await queryRunner.query(`
      DELETE o FROM user_permission_overrides o
      JOIN users quien_concede ON quien_concede.id = o.granted_by AND quien_concede.role = 'client'
      JOIN users destino ON destino.id = o.user_id AND destino.role = 'client' AND destino.client_id IS NOT NULL
      JOIN (
        SELECT user_id, module, client_id FROM user_permission_overrides WHERE client_id IS NOT NULL
      ) especifica ON especifica.user_id = o.user_id AND especifica.module = o.module AND especifica.client_id = destino.client_id
      WHERE o.client_id IS NULL
    `);

    // El resto pasa a valer sólo en la empresa de quien la recibió.
    await queryRunner.query(`
      UPDATE user_permission_overrides o
      JOIN users quien_concede ON quien_concede.id = o.granted_by AND quien_concede.role = 'client'
      JOIN users destino ON destino.id = o.user_id AND destino.role = 'client' AND destino.client_id IS NOT NULL
      SET o.client_id = destino.client_id
      WHERE o.client_id IS NULL
    `);
  }

  public async down(): Promise<void> {
    // Sin vuelta atrás a propósito: devolverlas a «en todas» es reabrir el acceso en empresas que
    // quien las concedió no administra, que es justo lo que esta migración cierra.
  }
}
