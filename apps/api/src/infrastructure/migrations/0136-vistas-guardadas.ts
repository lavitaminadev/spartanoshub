import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Filtros con nombre que se pueden compartir con el equipo.
 *
 * Hasta acá vivían en el navegador de cada persona: no se compartían y se perdían al cambiar de
 * computador. Guardarlas en el servidor permite que «Hoy sin confirmar» la arme una persona y la
 * use todo el turno.
 *
 * **Es una tabla nueva: no toca ningún dato existente.** Las vistas que cada uno ya tenía en su
 * navegador se suben la primera vez que abre la pantalla, como privadas.
 *
 * Una vista guarda **filtros, no datos**: compartirla no le muestra a nadie una reserva que no
 * podía ver, porque al aplicarla la lista se sigue pidiendo con los permisos de quien la abre.
 *
 * `client_id` separa las vistas del portal de las del equipo interno: quien entra por el portal de
 * una empresa sólo ve las de esa empresa, y nunca las de la agencia.
 */
export class VistasGuardadas1758800000000 implements MigrationInterface {
  name = 'VistasGuardadas1758800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('saved_views')) return;
    await queryRunner.query(`
      CREATE TABLE saved_views (
        id uuid NOT NULL,
        organization_id uuid NOT NULL,
        client_id uuid NULL,
        owner_user_id uuid NOT NULL,
        scope varchar(80) NOT NULL,
        name varchar(60) NOT NULL,
        filters json NOT NULL,
        shared tinyint(1) NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_saved_views_owner_scope_name (owner_user_id, scope, name),
        KEY IDX_saved_views_org_scope (organization_id, scope)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('saved_views')) await queryRunner.query('DROP TABLE saved_views');
  }
}
