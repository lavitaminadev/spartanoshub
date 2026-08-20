import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Cuenta a la que se limita una automatización.
 *
 * Hasta ahora una automatización pertenecía a la organización entera: cualquier trato de
 * cualquier cuenta la disparaba. Con una sola cuenta operando eso no se nota; con varias, una
 * regla escrita para el restaurante de un cliente se ejecutaba también sobre los tratos de otro
 * —avisando a su equipo, creando sus tareas— y no había forma de acotarla.
 *
 * **Admite vacío a propósito.** Nulo significa «vale para todas las cuentas», que es lo que hoy
 * hacen todas las automatizaciones existentes: al no rellenarse, siguen comportándose
 * exactamente igual después de migrar. Sin esa opción, migrar habría obligado a elegir una
 * cuenta para cada regla ya escrita, y a apagar de hecho las que son de verdad transversales.
 *
 * El índice acompaña a la consulta que hace el despachador en cada evento —organización,
 * disparador, activas— a la que ahora se suma la cuenta.
 */
export class AutomationClientScope1755900000103 implements MigrationInterface {
  name = 'AutomationClientScope1755900000103';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('automations'))) return;
    if (await queryRunner.hasColumn('automations', 'client_id')) return;

    await queryRunner.addColumn('automations', new TableColumn({
      name: 'client_id',
      type: 'char',
      length: '36',
      isNullable: true,
    }));

    await queryRunner.createIndex('automations', new TableIndex({
      name: 'IDX_automations_org_client_trigger',
      columnNames: ['organization_id', 'client_id', 'trigger_type'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('automations'))) return;

    const tabla = await queryRunner.getTable('automations');
    if (tabla?.indices.some((indice) => indice.name === 'IDX_automations_org_client_trigger')) {
      await queryRunner.dropIndex('automations', 'IDX_automations_org_client_trigger');
    }
    if (await queryRunner.hasColumn('automations', 'client_id')) {
      await queryRunner.dropColumn('automations', 'client_id');
    }
  }
}
