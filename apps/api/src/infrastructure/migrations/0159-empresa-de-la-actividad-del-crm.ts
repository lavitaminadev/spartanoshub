import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna, hayIndice } from './helpers/catalogo';

/**
 * Empresa propia en la actividad del CRM.
 *
 * Hasta ahora la empresa de una actividad se deducía de su lead o de su contacto. Una actividad
 * que no cuelga de ninguno —una reunión de equipo, un bloqueo de agenda, que el calendario permite
 * a propósito— no pertenecía a ninguna empresa: el listado la dejaba fuera para cualquiera que no
 * viera la organización entera, y por eso crearla terminaba en «Interaction not found».
 *
 * El relleno copia la empresa que ya tenían por su lead o su contacto, para que nada cambie de
 * dueño ni desaparezca de una lista. Sólo escribe lo que está vacío: correrla dos veces no cambia
 * el resultado.
 */
export class EmpresaDeLaActividadDelCrm1790000000159 implements MigrationInterface {
  name = 'EmpresaDeLaActividadDelCrm1790000000159';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_interactions'))) return;
    if (!(await hayColumna(queryRunner, 'crm_interactions', 'client_id'))) {
      await queryRunner.query('ALTER TABLE crm_interactions ADD COLUMN client_id CHAR(36) NULL');
    }
    if (!(await hayIndice(queryRunner, 'crm_interactions', 'IDX_crm_interactions_org_client'))) {
      await queryRunner.query('CREATE INDEX IDX_crm_interactions_org_client ON crm_interactions (organization_id, client_id)');
    }
    if (await queryRunner.hasTable('leads')) {
      await queryRunner.query(`
        UPDATE crm_interactions i
        JOIN leads l ON l.id = i.lead_id AND l.organization_id = i.organization_id
        SET i.client_id = l.client_id
        WHERE i.client_id IS NULL AND l.client_id IS NOT NULL
      `);
    }
    if (await queryRunner.hasTable('crm_contacts')) {
      await queryRunner.query(`
        UPDATE crm_interactions i
        JOIN crm_contacts c ON c.id = i.contact_id AND c.organization_id = i.organization_id
        SET i.client_id = c.client_id
        WHERE i.client_id IS NULL AND c.client_id IS NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_interactions'))) return;
    if (await hayIndice(queryRunner, 'crm_interactions', 'IDX_crm_interactions_org_client')) {
      await queryRunner.query('DROP INDEX IDX_crm_interactions_org_client ON crm_interactions');
    }
    if (await hayColumna(queryRunner, 'crm_interactions', 'client_id')) {
      await queryRunner.query('ALTER TABLE crm_interactions DROP COLUMN client_id');
    }
  }
}
