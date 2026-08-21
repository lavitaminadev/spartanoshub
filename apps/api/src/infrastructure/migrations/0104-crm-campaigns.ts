import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Campañas de captación con su inversión.
 *
 * Es lo único que falta para poder responder cuánto cuesta un lead: los leads ya guardan de qué
 * campaña vinieron en `campaign_name`, pero no había dónde anotar lo que se gastó en ella.
 *
 * Tabla nueva y nada más: no toca `leads` ni ninguna otra. Si se revierte, el panel deja de
 * mostrar el costo por lead y todo lo demás sigue igual.
 */
export class CrmCampaigns1755900000104 implements MigrationInterface {
  name = 'CrmCampaigns1755900000104';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('crm_campaigns')) return;

    await queryRunner.createTable(new Table({
      name: 'crm_campaigns',
      columns: [
        { name: 'id', type: 'char', length: '36', isPrimary: true },
        { name: 'organization_id', type: 'char', length: '36', isNullable: false },
        { name: 'client_id', type: 'char', length: '36', isNullable: true },
        { name: 'name', type: 'varchar', length: '180', isNullable: false },
        { name: 'source', type: 'varchar', length: '50', default: "'Meta Ads'" },
        { name: 'starts_at', type: 'date', isNullable: true },
        { name: 'ends_at', type: 'date', isNullable: true },
        // Igual que el monto del lead: se divide entre el conteo para obtener el costo por lead,
        // y en coma flotante ese error se arrastra a la división.
        { name: 'investment', type: 'decimal', precision: 14, scale: 2, default: 0 },
        { name: 'status', type: 'varchar', length: '20', default: "'active'" },
        { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
        {
          name: 'updated_at',
          type: 'datetime',
          precision: 6,
          default: 'CURRENT_TIMESTAMP(6)',
          onUpdate: 'CURRENT_TIMESTAMP(6)',
        },
      ],
    }), true);

    // El panel busca por organización y nombre para cruzar con `leads.campaign_name`.
    await queryRunner.createIndex('crm_campaigns', new TableIndex({
      name: 'IDX_crm_campaigns_org_name',
      columnNames: ['organization_id', 'name'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('crm_campaigns')) {
      await queryRunner.dropTable('crm_campaigns');
    }
  }
}
