import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Qué preguntas de un formulario de Meta llenan cada campo propio del CRM.
 *
 * Las respuestas que no son nombre, correo, teléfono o empresa se pegaban en las notas del lead
 * como texto: «presupuesto: $500.000». Se veían, pero no se podían filtrar, contar ni mostrar en
 * columna, que es justo lo que sabe hacer un campo propio.
 *
 * Va en la definición del campo y no en una tabla aparte porque es parte de cómo se llena ese
 * campo: al archivarlo deja de recibir, y al borrarlo no queda una equivalencia huérfana. Un
 * campo sin preguntas se comporta como hasta ahora.
 */
export class PreguntasDeMetaPorCampo1790000000150 implements MigrationInterface {
  name = 'PreguntasDeMetaPorCampo1790000000150';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_field_definitions'))) return;
    const tabla = await queryRunner.getTable('crm_field_definitions');
    if (!tabla?.findColumnByName('meta_questions')) {
      await queryRunner.addColumn('crm_field_definitions', new TableColumn({
        name: 'meta_questions', type: 'json', isNullable: true,
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('crm_field_definitions'))) return;
    const tabla = await queryRunner.getTable('crm_field_definitions');
    if (tabla?.findColumnByName('meta_questions')) await queryRunner.dropColumn('crm_field_definitions', 'meta_questions');
  }
}
